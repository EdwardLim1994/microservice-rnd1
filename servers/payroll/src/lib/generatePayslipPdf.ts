import { PDFDocument, StandardFonts } from "pdf-lib";

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

export interface PayslipPdfInput {
	fullName: string;
	employeeId: string;
	role: string;
	department: string;
	grossSalary: number;
	month: number;
	year: number;
	generatedAt: Date;
}

export async function generatePayslipPdf(
	input: PayslipPdfInput,
): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	const page = doc.addPage([400, 500]);
	const font = await doc.embedFont(StandardFonts.Helvetica);

	const lines = [
		"Payslip",
		`Employee: ${input.fullName}`,
		`Employee ID: ${input.employeeId}`,
		`Role: ${input.role}`,
		`Department: ${input.department}`,
		`Gross Salary: ${input.grossSalary.toFixed(2)}`,
		`Period: ${MONTH_NAMES[input.month - 1]} ${input.year}`,
		`Generated: ${input.generatedAt.toISOString()}`,
	];

	let y = 450;
	for (const line of lines) {
		page.drawText(line, { x: 40, y, size: 14, font });
		y -= 30;
	}

	return doc.save();
}
