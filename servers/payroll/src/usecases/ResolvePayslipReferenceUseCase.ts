import { BaseUseCase } from "server";
import PayslipRepository from "../repositories/PayslipRepository";

export default class ResolvePayslipReferenceUseCase extends BaseUseCase<{ id: string }, unknown> {
	private readonly payslipRepository: PayslipRepository;

	constructor({ payslipRepository }: { payslipRepository: PayslipRepository }) {
		super();
		this.payslipRepository = payslipRepository;
	}

	execute({ id }: { id: string }) {
		return this.payslipRepository.findById(id);
	}
}
