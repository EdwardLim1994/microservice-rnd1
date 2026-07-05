import { Button } from "@heroui/react";
import { useDemo1 } from "../viewmodel";

export function Demo1Page() {
	const { data, loading, error } = useDemo1();

	if (loading) {
		return <p>Loading…</p>;
	}

	if (error) {
		return (
			<div>
				<Button onClick={() => alert("Clicked")}>Click me</Button>
				<p>Failed to load demo1: {error.message}</p>
			</div>
		);
	}

	if (!data?.demo1) {
		return <p>No demo1 found.</p>;
	}

	return (
		<div className="flex flex-col items-center gap-2">
			<p className="text-lg font-semibold">
				{data.demo1.name} (#{data.demo1.id})
			</p>
			{(data.demo1.demo2 ?? [])
				.filter((child) => child != null)
				.map((child) => (
					<p key={child.id}>
						- {child.name} (#{child.id})
					</p>
				))}
		</div>
	);
}
