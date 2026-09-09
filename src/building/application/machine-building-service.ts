import type { EventEnvelope, EventPublisher } from "../../kernel/events/contracts";
import type { JsonValue } from "../../kernel/json";
import type { Result } from "../../kernel/result";
import { Machine, type AddPartInput, type MachineChange, type MachineDependencies, type PlaceAndConnectInput } from "../domain/machine";
import type { ConnectionInput, ControlBindingInput, DomainEvent, MachineBlueprint, MachineCommandError, PartTransform, RotationAxis } from "../domain/contracts";
import { parseMachineBlueprint } from "../domain/blueprint";
import type { MachineRepository } from "../ports/machine-repository";
import type { PartCatalog } from "../ports/part-catalog";

export interface BuildingCommandError {
  readonly code: string;
  readonly details?: Readonly<Record<string, JsonValue>>;
}

export type BuildingCommand =
  | { readonly type: "add-part"; readonly part: AddPartInput }
  | { readonly type: "place-and-connect"; readonly placement: PlaceAndConnectInput }
  | { readonly type: "remove-part"; readonly partId: string }
  | { readonly type: "move-part"; readonly partId: string; readonly transform: PartTransform }
  | { readonly type: "rotate-part"; readonly partId: string; readonly axis: RotationAxis; readonly steps?: number }
  | { readonly type: "connect-parts"; readonly connection: ConnectionInput }
  | { readonly type: "disconnect-parts"; readonly connectionId: string }
  | { readonly type: "configure-part"; readonly partId: string; readonly configuration: Readonly<Record<string, JsonValue>> }
  | { readonly type: "bind-control"; readonly binding: ControlBindingInput };

export interface BuildingEventOptions {
  readonly id?: () => string;
  readonly now?: () => string;
  readonly producer?: string;
  readonly sequence?: () => number;
  readonly canEdit?: (machineId: string) => boolean | Promise<boolean>;
}

function defaultId(): string {
  return globalThis.crypto.randomUUID();
}

let defaultEventSequence = 0;

function nextDefaultSequence(): number {
  defaultEventSequence += 1;
  return defaultEventSequence;
}

export class MachineBuildingService {
  private readonly eventOptions: Required<Omit<BuildingEventOptions, "canEdit">>;
  private readonly canEdit: (machineId: string) => boolean | Promise<boolean>;
  private readonly queues = new Map<string, Promise<void>>();
  private readonly simulationLocks = new Set<string>();

  public constructor(
    private readonly repository: MachineRepository,
    private readonly catalog: PartCatalog,
    private readonly events: EventPublisher,
    options: BuildingEventOptions = {},
  ) {
    this.eventOptions = {
      id: options.id ?? defaultId,
      now: options.now ?? (() => new Date().toISOString()),
      producer: options.producer ?? "building.application",
      sequence: options.sequence ?? nextDefaultSequence,
    };
    this.canEdit = options.canEdit ?? (() => true);
  }

  public describeDependencies(): readonly string[] {
    return [this.repository.constructor.name, this.catalog.constructor.name, this.events.constructor.name];
  }

  public load(machineId: string, correlationId = this.eventOptions.id()): Promise<Result<MachineBlueprint, BuildingCommandError>> {
    return this.enqueue(machineId, () => this.loadNow(machineId, correlationId));
  }

  public replace(machineId: string, blueprint: MachineBlueprint, correlationId = this.eventOptions.id()): Promise<Result<MachineBlueprint, BuildingCommandError>> {
    return this.enqueue(machineId, async () => {
      if (this.simulationLocks.has(machineId) || !await this.canEdit(machineId)) return { ok: false, error: { code: "building.mode.invalid" } };
      const current = await this.repository.get(machineId);
      if (current === undefined) return { ok: false, error: { code: "building.machine.not-found" } };
      const candidate = { ...blueprint, id: current.id, version: current.version + 1 };
      const parsed = parseMachineBlueprint(candidate, this.dependencies());
      if (!parsed.ok) return { ok: false, error: { code: parsed.error.code, ...(parsed.error.path === undefined ? {} : { details: { path: parsed.error.path } }) } };
      const saved = await this.repository.save(parsed.value, current.version);
      if (!saved.ok) return { ok: false, error: { code: saved.code } };
      this.publishApplicationEvent("building.machine.replaced", machineId, correlationId, { version: parsed.value.version }, "info");
      return { ok: true, value: parsed.value };
    });
  }

  public acquireSimulationSnapshot(machineId: string, correlationId = this.eventOptions.id()): Promise<Result<MachineBlueprint, BuildingCommandError>> {
    return this.enqueue(machineId, async () => {
      if (this.simulationLocks.has(machineId) || !await this.canEdit(machineId)) {
        const failure = { code: "building.mode.invalid" };
        this.publishApplicationEvent("building.simulation.snapshot-rejected", machineId, correlationId, failure, "warn");
        return { ok: false, error: failure };
      }
      const loaded = await this.loadNow(machineId, correlationId);
      if (!loaded.ok) return loaded;
      this.simulationLocks.add(machineId);
      this.publishApplicationEvent("building.simulation.snapshot-acquired", machineId, correlationId, { version: loaded.value.version }, "info");
      return loaded;
    });
  }

  public releaseSimulation(machineId: string, correlationId = this.eventOptions.id()): Promise<void> {
    return this.enqueue(machineId, async () => {
      this.simulationLocks.delete(machineId);
      this.publishApplicationEvent("building.simulation.snapshot-released", machineId, correlationId, {}, "info");
      await Promise.resolve();
    });
  }

  private async loadNow(machineId: string, correlationId: string): Promise<Result<MachineBlueprint, BuildingCommandError>> {
    try {
      const blueprint = await this.repository.get(machineId);
      if (blueprint === undefined) {
        const failure = { code: "building.machine.not-found" };
        this.publishApplicationEvent("building.machine.load-failed", machineId, correlationId, failure, "warn");
        return { ok: false, error: failure };
      }
      const parsed = parseMachineBlueprint(blueprint, this.dependencies());
      if (!parsed.ok) {
        const failure = { code: parsed.error.code, ...(parsed.error.path === undefined ? {} : { details: { path: parsed.error.path } }) };
        this.publishApplicationEvent("building.machine.load-failed", machineId, correlationId, failure, "warn");
        return { ok: false, error: failure };
      }
      this.publishApplicationEvent("building.machine.loaded", machineId, correlationId, { version: parsed.value.version }, "info");
      return parsed;
    } catch {
      const failure = { code: "building.repository.failed" };
      this.publishApplicationEvent("building.machine.load-failed", machineId, correlationId, failure, "error");
      return { ok: false, error: failure };
    }
  }

  public create(machineId: string, correlationId = this.eventOptions.id()): Promise<Result<MachineBlueprint, BuildingCommandError>> {
    return this.enqueue(machineId, () => this.createNow(machineId, correlationId));
  }

  private async createNow(machineId: string, correlationId: string): Promise<Result<MachineBlueprint, BuildingCommandError>> {
    const commandId = this.publishCommand("create-machine", correlationId, { machineId }, machineId);
    if (this.simulationLocks.has(machineId) || !await this.canEdit(machineId)) {
      const failure = { code: "building.mode.invalid" };
      this.publishRejection("create-machine", correlationId, failure, machineId, commandId);
      return { ok: false, error: failure };
    }
    const machineResult = Machine.create(machineId, this.dependencies());
    if (!machineResult.ok) {
      this.publishRejection("create-machine", correlationId, machineResult.error, machineId, commandId);
      return { ok: false, error: machineResult.error };
    }
    const blueprint = machineResult.value.blueprint;
    let saved;
    try {
      saved = await this.repository.save(blueprint);
    } catch {
      const failure = { code: "building.repository.failed" };
      this.publishRejection("create-machine", correlationId, failure, machineId, commandId);
      return { ok: false, error: failure };
    }
    if (!saved.ok) {
      const failure = { code: saved.code };
      this.publishRejection("create-machine", correlationId, failure, machineId, commandId);
      return { ok: false, error: failure };
    }
    this.publishDomain({ type: "building.machine.created", payload: { machineId, version: blueprint.version } }, correlationId, machineId, commandId);
    return { ok: true, value: blueprint };
  }

  public async execute(machineId: string, command: BuildingCommand, correlationId = this.eventOptions.id()): Promise<Result<MachineBlueprint, BuildingCommandError>> {
    return this.enqueue(machineId, () => this.executeNow(machineId, command, correlationId));
  }

  private async executeNow(machineId: string, command: BuildingCommand, correlationId: string): Promise<Result<MachineBlueprint, BuildingCommandError>> {
    const commandId = this.publishCommand(command.type, correlationId, { commandType: command.type }, machineId);
    if (this.simulationLocks.has(machineId) || !await this.canEdit(machineId)) {
      const failure = { code: "building.mode.invalid" };
      this.publishRejection(command.type, correlationId, failure, machineId, commandId);
      return { ok: false, error: failure };
    }
    let current;
    try {
      current = await this.repository.get(machineId);
    } catch {
      const failure = { code: "building.repository.failed" };
      this.publishRejection(command.type, correlationId, failure, machineId, commandId);
      return { ok: false, error: failure };
    }
    if (current === undefined) {
      const failure = { code: "building.machine.not-found" };
      this.publishRejection(command.type, correlationId, failure, machineId, commandId);
      return { ok: false, error: failure };
    }
    const restored = Machine.restore(current, this.dependencies());
    if (!restored.ok) {
      const failure = restored.error;
      this.publishRejection(command.type, correlationId, failure, machineId, commandId);
      return { ok: false, error: failure };
    }
    const machine = restored.value;
    const result = this.apply(machine, command);
    if (!result.ok) {
      this.publishRejection(command.type, correlationId, result.error, machineId, commandId);
      return { ok: false, error: result.error };
    }
    if (this.simulationLocks.has(machineId) || !await this.canEdit(machineId)) {
      const failure = { code: "building.mode.invalid" };
      this.publishRejection(command.type, correlationId, failure, machineId, commandId);
      return { ok: false, error: failure };
    }
    let saved;
    try {
      saved = await this.repository.save(result.value.blueprint, current.version);
    } catch {
      const failure = { code: "building.repository.failed" };
      this.publishRejection(command.type, correlationId, failure, machineId, commandId);
      return { ok: false, error: failure };
    }
    if (!saved.ok) {
      const failure = { code: saved.code };
      this.publishRejection(command.type, correlationId, failure, machineId, commandId);
      return { ok: false, error: failure };
    }
    for (const domainEvent of result.value.events) this.publishDomain(domainEvent, correlationId, machineId, commandId);
    return { ok: true, value: result.value.blueprint };
  }

  public addPart(machineId: string, part: AddPartInput, correlationId?: string) { return this.execute(machineId, { type: "add-part", part }, correlationId); }
  public placeAndConnect(machineId: string, placement: PlaceAndConnectInput, correlationId?: string) { return this.execute(machineId, { type: "place-and-connect", placement }, correlationId); }
  public removePart(machineId: string, partId: string, correlationId?: string) { return this.execute(machineId, { type: "remove-part", partId }, correlationId); }
  public movePart(machineId: string, partId: string, transform: PartTransform, correlationId?: string) { return this.execute(machineId, { type: "move-part", partId, transform }, correlationId); }
  public rotatePart(machineId: string, partId: string, axis: RotationAxis, steps = 1, correlationId?: string) { return this.execute(machineId, { type: "rotate-part", partId, axis, steps }, correlationId); }
  public connectParts(machineId: string, connection: ConnectionInput, correlationId?: string) { return this.execute(machineId, { type: "connect-parts", connection }, correlationId); }
  public disconnectParts(machineId: string, connectionId: string, correlationId?: string) { return this.execute(machineId, { type: "disconnect-parts", connectionId }, correlationId); }
  public configurePart(machineId: string, partId: string, configuration: Readonly<Record<string, JsonValue>>, correlationId?: string) { return this.execute(machineId, { type: "configure-part", partId, configuration }, correlationId); }
  public bindControl(machineId: string, binding: ControlBindingInput, correlationId?: string) { return this.execute(machineId, { type: "bind-control", binding }, correlationId); }

  private dependencies(): MachineDependencies {
    return { resolvePart: (definitionId) => this.catalog.get(definitionId) };
  }

  private apply(machine: Machine, command: BuildingCommand): Result<MachineChange, MachineCommandError> {
    switch (command.type) {
      case "add-part": return machine.addPart(command.part);
      case "place-and-connect": return machine.placeAndConnect(command.placement);
      case "remove-part": return machine.removePart(command.partId);
      case "move-part": return machine.movePart(command.partId, command.transform);
      case "rotate-part": return machine.rotatePart(command.partId, command.axis, command.steps);
      case "connect-parts": return machine.connectParts(command.connection);
      case "disconnect-parts": return machine.disconnect(command.connectionId);
      case "configure-part": return machine.configurePart(command.partId, command.configuration);
      case "bind-control": return machine.bindControl(command.binding);
    }
  }

  private publishCommand(type: string, correlationId: string, payload: JsonValue, machineId: string): string {
    const id = this.eventOptions.id();
    this.events.publish(this.envelope("building.command.received", { commandType: type, payload }, correlationId, machineId, undefined, "info", id));
    return id;
  }

  private publishRejection(type: string, correlationId: string, rejection: { readonly code: string; readonly details?: Readonly<Record<string, JsonValue>> }, machineId: string, commandId: string): void {
    this.events.publish(this.envelope("building.command.rejected", { commandType: type, errorCode: rejection.code, ...(rejection.details === undefined ? {} : { details: rejection.details }) }, correlationId, machineId, commandId, "warn"));
  }

  private publishDomain(domainEvent: DomainEvent, correlationId: string, machineId: string, commandId: string): void {
    this.events.publish(this.envelope(domainEvent.type, domainEvent.payload, correlationId, machineId, commandId));
  }

  private publishApplicationEvent(type: string, machineId: string, correlationId: string, payload: JsonValue, severity: EventEnvelope["severity"]): void {
    this.events.publish(this.envelope(type, payload, correlationId, machineId, undefined, severity));
  }

  private envelope(type: string, payload: JsonValue, correlationId: string, machineId: string, causationId?: string, severity: EventEnvelope["severity"] = "info", eventId = this.eventOptions.id()): EventEnvelope {
    return {
      id: eventId,
      type,
      eventVersion: 1,
      occurredAt: this.eventOptions.now(),
      observedAt: this.eventOptions.now(),
      sequence: this.eventOptions.sequence(),
      severity,
      producer: this.eventOptions.producer,
      correlationId,
      ...(causationId === undefined ? {} : { causationId }),
      context: { machineId },
      payload,
    };
  }

  private enqueue<T>(machineId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(machineId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.queues.set(machineId, current.then(() => undefined, () => undefined));
    return current;
  }
}
