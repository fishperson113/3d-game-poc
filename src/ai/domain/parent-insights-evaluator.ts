import type { HintTier, ParentInsightsReport } from "./contracts";

export class ParentInsightsEvaluator {
  public evaluate(challengeId: string, challengeTitle: string, attemptCount: number, highestTierUsed: HintTier): ParentInsightsReport {
    // Autonomy score based on how independently the student solved the problem
    let autonomyScorePercent: number;
    if (highestTierUsed === 1) autonomyScorePercent = 95;
    else if (highestTierUsed === 2) autonomyScorePercent = 88;
    else if (highestTierUsed === 3) autonomyScorePercent = 78;
    else if (highestTierUsed === 4) autonomyScorePercent = 68;
    else autonomyScorePercent = 55;

    // Adjust slightly for resilience (trying multiple times is good for learning)
    if (attemptCount >= 2 && attemptCount <= 5) {
      autonomyScorePercent = Math.min(100, autonomyScorePercent + 5);
    }

    const concepts: string[] = [];
    let feedback: string;
    let prompt: string;

    if (challengeId === "high-peak") {
      concepts.push("Góc Vượt Đỉnh (Breakover Angle)", "Chiều Dài Cơ Sở (Wheelbase)", "Phân Bổ Lực Đè Khung Gầm");
      feedback = "Bé đã quan sát rất tốt hiện tượng xe bị 'kẹt bụng' khi thân xe quá dài. Bé hiểu được tại sao xe trục cơ sở ngắn lại linh hoạt hơn khi vượt qua các địa hình dốc nhọn.";
      prompt = "Ba/Mẹ có thể hỏi bé: 'Hôm nay con thấy tại sao chiếc xe dài lại bị kẹt trên đỉnh gờ nhọn mà chiếc xe ngắn lại leo qua được vậy con?'";
    } else if (challengeId === "v-trench") {
      concepts.push("Mô-Men Xoắn (Torque)", "Góc Tiếp Cận (Approach Angle)", "Bánh Tỳ Cơ Khí");
      feedback = "Bé đã hiểu mối quan hệ giữa lực kéo động cơ và độ dốc. Bé biết cách gắn thêm bánh răng trợ lực ở mũi xe để tăng lực kéo và làm điểm tựa vượt dốc.";
      prompt = "Ba/Mẹ có thể hỏi bé: 'Khi xe lên dốc bị yếu, con đã làm cách nào để giúp xe có thêm lực kéo để leo lên tới đỉnh?'";
    } else if (challengeId === "bumpy-road") {
      concepts.push("Trọng Tâm Thân Xe (Center of Mass)", "Quán Tính Chống Lật", "Ma Sát & Độ Đầm Chắc");
      feedback = "Bé đã khám phá ra nguyên lý hạ thấp trọng tâm xe bằng cách gắn thêm hộp pin đối trọng nặng, giúp xe chạy đầm chắc và không bị lật khi đi qua đá nhấp nhô.";
      prompt = "Ba/Mẹ có thể hỏi bé: 'Tại sao khi lắp thêm hộp pin nặng vào giữa xe, xe lại chạy êm và không bị nảy tưng tưng nữa hả con?'";
    } else {
      concepts.push("Cơ Khí Lắp Ráp", "Truyền Động Bánh Xe", "Tư Duy Thử Nghiệm & Cải Tiến");
      feedback = "Bé thể hiện sự kiên trì và tư duy thiết kế kỹ thuật (Design Thinking), kiên nhẫn thử nghiệm và cải tiến xe qua từng lần lái thử.";
      prompt = "Ba/Mẹ có thể hỏi bé: 'Chiếc xe con vừa chế tạo có những bộ phận đặc biệt nào giúp nó chạy nhanh và vững chắc vậy?'";
    }

    return {
      challengeId,
      challengeTitle,
      attemptCount,
      highestTierUsed,
      autonomyScorePercent,
      masteredConcepts: concepts,
      qualitativeFeedback: feedback,
      parentDiscussionPrompt: prompt,
    };
  }
}
