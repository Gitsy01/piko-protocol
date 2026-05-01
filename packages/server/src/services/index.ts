import { GrowthService } from "./growthService";
import { PaymentService } from "./paymentService";
import { QuestService } from "./questService";
import { RewardService } from "./rewardService";

export const growthService = new GrowthService();
export const paymentService = new PaymentService();
export const rewardService = new RewardService();
export const questService = new QuestService(paymentService, rewardService);

export { GrowthService, PaymentService, QuestService, RewardService };
