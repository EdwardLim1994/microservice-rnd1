import { router } from "expo-router";
import { Button } from "heroui-native";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useDemo1 } from "../viewmodel";

function BackButton() {
	return (
		<Button
			variant="secondary"
			className="self-start"
			onPress={() => router.back()}
		>
			← Back
		</Button>
	);
}

export function Demo1Page() {
	const { data, loading, error } = useDemo1();

	if (loading) {
		return (
			<View>
				<BackButton />
				<View>
					<ActivityIndicator />
				</View>
			</View>
		);
	}

	if (error) {
		return (
			<View>
				<BackButton />
				<View>
					<Text>Failed to load demo1: {error.message}</Text>
				</View>
			</View>
		);
	}

	if (!data?.demo1) {
		return (
			<View>
				<BackButton />
				<View>
					<Text>No demo1 found.</Text>
				</View>
			</View>
		);
	}

	return (
		<View className="h-full pt-15 bg-background">
			<BackButton />
			<View className="flex m-auto gap-y-2">
				<Text className="text-xl font-bold text-center text-foreground">
					{data.demo1.name} (#{data.demo1.id})
				</Text>
				{(data.demo1.demo2 ?? [])
					.filter((child) => child != null)
					.map((child) => (
						<Text className="italic text-center text-foreground" key={child.id}>
							- {child.name} (#{child.id})
						</Text>
					))}
			</View>
		</View>
	);
}
