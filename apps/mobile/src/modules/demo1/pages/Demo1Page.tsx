import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useDemo1 } from '../viewmodels';

export function Demo1Page() {
  const { data, loading, error } = useDemo1();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text>Failed to load demo1: {error.message}</Text>
      </View>
    );
  }

  if (!data?.demo1) {
    return (
      <View style={styles.container}>
        <Text>No demo1 found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {data.demo1.name} (#{data.demo1.id})
      </Text>
      {(data.demo1.demo2 ?? []).filter((child) => child != null).map((child) => (
        <Text key={child.id}>
          - {child.name} (#{child.id})
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
});
