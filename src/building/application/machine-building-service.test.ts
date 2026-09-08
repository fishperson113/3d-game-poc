import { describe, expect, it } from "vitest";
import { MemoryMachineRepository } from "../../adapters/storage/memory-machine-repository";
import { asMachineId, type MachineBlueprint } from "../domain/contracts";
import type { EventEnvelope, EventPublisher } from "../../kernel/events/contracts";
import { MachineBuildingService } from "./machine-building-service";

class RecordingPublisher implements EventPublisher {
  public readonly events: EventEnvelope[] = [];

  public publish(event: EventEnvelope): void {
    this.events.push(event);
  }

  public subscribe(): () => void {
    return () => undefined;
  }
}

describe("MachineBuildingService", () => {
  it("publishes correlated command and domain events", async () => {
    const publisher = new RecordingPublisher();
    const service = new MachineBuildingService(new MemoryMachineRepository(), { get: () => ({ id: "block", version: 1, sockets: [], capabilities: [] }) }, publisher, {
      id: (() => { let count = 0; return () => `id-${String(++count)}`; })(),
      now: () => "2026-01-01T00:00:00.000Z",
    });
    expect((await service.create("machine", "corr-1")).ok).toBe(true);
    const result = await service.addPart("machine", { id: "part", definitionId: "block", transform: { position: [0, 0, 0], rotation: [0, 0, 0] } }, "corr-2");
    expect(result.ok).toBe(true);
    const command = publisher.events.find((event) => event.correlationId === "corr-2" && event.type === "building.command.received");
    const domain = publisher.events.find((event) => event.correlationId === "corr-2" && event.type === "building.part.added");
    expect(command).toBeDefined();
    expect(domain?.causationId).toBe(command?.id);
    expect(domain?.sequence).toBeGreaterThan(command?.sequence ?? 0);
  });

  it("logs a rejection with the same correlation and error code", async () => {
    const publisher = new RecordingPublisher();
    const service = new MachineBuildingService(new MemoryMachineRepository(), { get: () => undefined }, publisher, { id: () => "id", now: () => "now" });
    await service.create("machine", "corr");
    const result = await service.addPart("missing", { id: "part", definitionId: "block", transform: { position: [0, 0, 0], rotation: [0, 0, 0] } }, "corr-reject");
    expect(result).toMatchObject({ ok: false, error: { code: "building.machine.not-found" } });
    const rejection = publisher.events.find((event) => event.type === "building.command.rejected" && event.correlationId === "corr-reject");
    expect(rejection).toBeDefined();
    expect(rejection?.payload).toEqual({ commandType: "add-part", errorCode: "building.machine.not-found" });
  });

  it("rejects building commands while the application is not editable", async () => {
    const publisher = new RecordingPublisher();
    const service = new MachineBuildingService(new MemoryMachineRepository(), { get: () => ({ id: "block", version: 1, sockets: [], capabilities: [] }) }, publisher, { canEdit: () => false, id: () => "id", now: () => "now" });
    expect(await service.create("machine", "mode")).toMatchObject({ ok: false, error: { code: "building.mode.invalid" } });
    expect(publisher.events).toContainEqual(expect.objectContaining({ type: "building.command.rejected", correlationId: "mode" }));
  });

  it("checks edit permission again before save", async () => {
    let allowed = true;
    let checks = 0;
    const initial: MachineBlueprint = { schemaVersion: 1, id: asMachineId("machine"), version: 0, parts: [], connections: [], controlBindings: [] };
    const repository = {
      get: async () => { allowed = false; await Promise.resolve(); return initial; },
      save: async () => { await Promise.resolve(); return { ok: true as const }; },
    };
    const service = new MachineBuildingService(repository, { get: () => ({ id: "block", version: 1, sockets: [], capabilities: [] }) }, new RecordingPublisher(), { canEdit: () => { checks += 1; return allowed; }, id: () => "id", now: () => "now" });
    const result = await service.addPart("machine", { id: "part", definitionId: "block", transform: { position: [0, 0, 0], rotation: [0, 0, 0] } });
    expect(result).toMatchObject({ ok: false, error: { code: "building.mode.invalid" } });
    expect(checks).toBe(2);
  });

  it("freezes a committed snapshot for simulation and reopens editing on release", async () => {
    const service = new MachineBuildingService(new MemoryMachineRepository(), { get: () => ({ id: "block", version: 1, sockets: [], capabilities: [] }) }, new RecordingPublisher(), { id: () => "id", now: () => "now" });
    expect((await service.create("machine")).ok).toBe(true);
    const snapshot = await service.acquireSimulationSnapshot("machine");
    expect(snapshot).toMatchObject({ ok: true, value: { id: "machine", version: 0 } });
    expect(await service.addPart("machine", { id: "part", definitionId: "block", transform: { position: [0, 0, 0], rotation: [0, 0, 0] } })).toMatchObject({ ok: false, error: { code: "building.mode.invalid" } });
    await service.releaseSimulation("machine");
    expect((await service.addPart("machine", { id: "part", definitionId: "block", transform: { position: [0, 0, 0], rotation: [0, 0, 0] } })).ok).toBe(true);
  });

  it("traces load and repository failures without emitting a success event", async () => {
    const publisher = new RecordingPublisher();
    const service = new MachineBuildingService({ get: async () => { await Promise.resolve(); throw new Error("storage down"); }, save: async () => { await Promise.resolve(); return { ok: true as const }; } }, { get: () => undefined }, publisher, { id: () => "id", now: () => "now" });
    const result = await service.load("machine", "load-correlation");
    expect(result).toMatchObject({ ok: false, error: { code: "building.repository.failed" } });
    expect(publisher.events).toContainEqual(expect.objectContaining({ type: "building.machine.load-failed", correlationId: "load-correlation", severity: "error" }));

    const failedSavePublisher = new RecordingPublisher();
    const failedSaveService = new MachineBuildingService({ get: async () => { await Promise.resolve(); return undefined; }, save: async () => { await Promise.resolve(); throw new Error("storage down"); } }, { get: () => undefined }, failedSavePublisher, { id: () => "id", now: () => "now" });
    expect(await failedSaveService.create("machine", "create-correlation")).toMatchObject({ ok: false, error: { code: "building.repository.failed" } });
    expect(failedSavePublisher.events.some((event) => event.type === "building.machine.created")).toBe(false);
  });
});
