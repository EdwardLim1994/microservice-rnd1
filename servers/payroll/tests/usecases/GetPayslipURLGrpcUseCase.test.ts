import { expect, test } from "@rstest/core";
import GetPayslipURLGrpcUseCase from "../../src/usecases/GetPayslipURLGrpcUseCase";
import type GetPayslipURLUseCase from "../../src/usecases/GetPayslipURLUseCase";

test("maps the domain result to the proto PayslipDownloadURL shape", async () => {
	const expiresAt = new Date("2026-02-15T00:00:00.000Z");
	const mockUseCase = {
		execute: async (args: {
			input: { employeeId: string; month: number; year: number };
		}) => {
			expect(args.input).toEqual({ employeeId: "emp-1", month: 1, year: 2026 });
			return { url: "https://minio.local/presigned", expiresAt };
		},
	} as unknown as GetPayslipURLUseCase;

	const grpcUseCase = new GetPayslipURLGrpcUseCase({
		getPayslipURLUseCase: mockUseCase,
	});

	const result = await grpcUseCase.execute({
		$type: "payroll.GetPayslipURLRequest",
		employeeId: "emp-1",
		month: 1,
		year: 2026,
	});

	expect(result).toEqual({
		$type: "payroll.PayslipDownloadURL",
		url: "https://minio.local/presigned",
		expiresAt: expiresAt.toISOString(),
	});
});
