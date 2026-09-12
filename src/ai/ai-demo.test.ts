import { describe, expect, it } from "vitest";
import { PhysicsDiagnosticsEngine } from "./domain/physics-diagnostics";
import { SocraticTutorEngine } from "./domain/socratic-tutor";
import { AssemblyGuideGenerator } from "./domain/assembly-guide-generator";
import { ParentInsightsEvaluator } from "./domain/parent-insights-evaluator";
import type { MachineBlueprint } from "../building/domain/contracts";
import { asPartId } from "../building/domain/contracts";

const mockBlueprint: MachineBlueprint = {
  schemaVersion: 1,
  id: "test-car" as MachineBlueprint["id"],
  version: 1,
  parts: [
    { id: asPartId("chassis"), definitionId: "core.structural-block", transform: { position: [0, 0, 0], rotation: [0, 0, 0] } },
    { id: asPartId("wheel-fl"), definitionId: "core.powered-wheel", transform: { position: [-1, 0, 1], rotation: [0, 0, 0] } },
    { id: asPartId("wheel-fr"), definitionId: "core.powered-wheel", transform: { position: [1, 0, 1], rotation: [0, 0, 0] } },
    { id: asPartId("wheel-rl"), definitionId: "core.powered-wheel", transform: { position: [-1, 0, -1], rotation: [0, 0, 0] } },
    { id: asPartId("wheel-rr"), definitionId: "core.powered-wheel", transform: { position: [1, 0, -1], rotation: [0, 0, 0] } },
    { id: asPartId("gear-front"), definitionId: "core.drive-gear", transform: { position: [0, 0, 1.25], rotation: [0, 0, 0] } },
    { id: asPartId("battery"), definitionId: "core.battery-box", transform: { position: [0, 0.5, 0], rotation: [0, 0, 0] } },
  ],
  connections: [],
  controlBindings: [],
};

describe("AI STEM Integration (Demo Use Cases)", () => {
  describe("Use Case 1: Physics Diagnostics & 5-Tier Socratic Tutor", () => {
    const diagnostics = new PhysicsDiagnosticsEngine();
    const tutor = new SocraticTutorEngine();

    it("detects high-centered state when crawler vehicle is hung up on Level 5 peak", () => {
      const diagnosis = diagnostics.diagnose(
        {
          position: [0.1, 0.98, 2.3], // Elevated belly resting on peak tip
          elapsedSeconds: 4.5,
          throttle: 1,
          steering: 0,
          challengeId: "high-peak",
        },
        mockBlueprint
      );

      expect(diagnosis.kind).toBe("HIGH_CENTERED");
      expect(diagnosis.confidence).toBeGreaterThan(0.9);
      expect(diagnosis.title).toContain("Kẹt Bụng");
    });

    it("detects insufficient climbing torque when vehicle stalls on Level 4 slope", () => {
      const blueprintNoGear: MachineBlueprint = {
        ...mockBlueprint,
        parts: mockBlueprint.parts.filter((p) => p.definitionId !== "core.drive-gear"),
      };
      const diagnosis = diagnostics.diagnose(
        {
          position: [0, 0.45, 3.8], // Stalled on exit slope
          elapsedSeconds: 5.0,
          throttle: 1,
          steering: 0,
          challengeId: "v-trench",
        },
        blueprintNoGear
      );

      expect(diagnosis.kind).toBe("INSUFFICIENT_TORQUE");
      expect(diagnosis.title).toContain("Lực Kéo");
    });

    it("detects unstable rollover when vehicle roll angle exceeds 45 degrees", () => {
      // 60 deg roll quaternion around Z axis
      const sin30 = Math.sin(Math.PI / 6);
      const cos30 = Math.cos(Math.PI / 6);
      const diagnosis = diagnostics.diagnose(
        {
          position: [0, 0.5, 0],
          rotation: [0, 0, sin30, cos30],
          elapsedSeconds: 3.0,
          throttle: 1,
          steering: 0,
          challengeId: "bumpy-road",
        },
        mockBlueprint
      );

      expect(diagnosis.kind).toBe("UNSTABLE_ROLLOVER");
      expect(diagnosis.title).toContain("Lật Nghiêng");
    });

    it("serves 5 distinct scaffolded tiers of Socratic hints for Level 5 high-centering", () => {
      const hints = tutor.getHints("high-peak", "HIGH_CENTERED");
      expect(hints).toHaveLength(5);

      // Tier 1: Reminder
      expect(hints[0]?.tier).toBe(1);
      expect(hints[0]?.category).toBe("reminder");

      // Tier 2: Socratic Question (doesn't give away answer!)
      expect(hints[1]?.tier).toBe(2);
      expect(hints[1]?.category).toBe("socratic_question");
      expect(hints[1]?.content).toContain("tại sao xe không tiến tới được nhỉ?");

      // Tier 3: Focus Area
      expect(hints[2]?.tier).toBe(3);
      expect(hints[2]?.category).toBe("focus_area");
      expect(hints[2]?.content).toContain("trục bánh xe");

      // Tier 4: STEM Principle
      expect(hints[3]?.tier).toBe(4);
      expect(hints[3]?.category).toBe("stem_principle");
      expect(hints[3]?.content).toContain("Góc Vượt Đỉnh");
      expect(hints[3]?.stemPrinciple).toBeDefined();

      // Tier 5: Actionable guidance
      expect(hints[4]?.tier).toBe(5);
      expect(hints[4]?.category).toBe("actionable_step");
      expect(hints[4]?.content).toContain("Xe Trinh Sát 4 bánh");
    });
  });

  describe("Use Case 2: Digital-to-Physical Assembly Guide & Parent Insights", () => {
    const guide = new AssemblyGuideGenerator();
    const parentEvaluator = new ParentInsightsEvaluator();

    it("generates correct Bill of Materials (BOM) with counts and friendly metadata", () => {
      const bom = guide.generateBOM(mockBlueprint);
      expect(bom.length).toBeGreaterThanOrEqual(4);

      const wheelItem = bom.find((i) => i.definitionId === "core.powered-wheel");
      expect(wheelItem).toBeDefined();
      expect(wheelItem?.count).toBe(4);
      expect(wheelItem?.label).toContain("Bánh Xe");

      const gearItem = bom.find((i) => i.definitionId === "core.drive-gear");
      expect(gearItem).toBeDefined();
      expect(gearItem?.count).toBe(1);
    });

    it("generates step-by-step physical assembly guide starting from chassis", () => {
      const steps = guide.generateAssemblySteps(mockBlueprint);
      expect(steps.length).toBeGreaterThanOrEqual(3);

      // Step 1 is always Chassis
      expect(steps[0]?.stepNumber).toBe(1);
      expect(steps[0]?.title).toContain("Khung");

      // Wheel assembly step
      const wheelStep = steps.find((s) => s.title.includes("Bánh Xe"));
      expect(wheelStep).toBeDefined();
      expect(wheelStep?.instruction).toContain("Bánh Xe");
    });

    it("generates real-world observation checklist for Level 5", () => {
      const checklist = guide.generateRealWorldChecklist("high-peak");
      expect(checklist.length).toBeGreaterThanOrEqual(2);
      expect(checklist.some((c) => c.stemConcept.includes("Breakover"))).toBe(true);
    });

    it("evaluates parent insights with high autonomy score when solved with low hint tier", () => {
      const report = parentEvaluator.evaluate("high-peak", "Gờ Nhô Kẹt Bụng", 2, 2);
      expect(report.autonomyScorePercent).toBeGreaterThanOrEqual(85);
      expect(report.masteredConcepts.some((c) => c.includes("Góc Vượt Đỉnh"))).toBe(true);
      expect(report.parentDiscussionPrompt).toContain("kẹt trên đỉnh gờ");
    });
  });
});
