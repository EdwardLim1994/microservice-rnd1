import { BaseUseCase } from "server";

export default class ResolveLeaveRequestReviewedByUseCase extends BaseUseCase<
	{ reviewedById: string | null },
	{ __typename: "Employee"; id: string } | null
> {
	async execute({ reviewedById }: { reviewedById: string | null }) {
		if (!reviewedById) return null;
		return { __typename: "Employee" as const, id: reviewedById };
	}
}
