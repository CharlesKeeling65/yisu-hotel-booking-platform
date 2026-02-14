import { StyleSheet, Text, View } from 'react-native';

export default function ReviewsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>点评</Text>
      <Text style={styles.subtitle}>暂无内容</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#111',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
});
