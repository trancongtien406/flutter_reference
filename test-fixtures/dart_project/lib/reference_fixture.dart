abstract class Repository {
  Repository();
  String get value;
  set value(String next);
  void load();
}

class MemoryRepository implements Repository {
  MemoryRepository();
  String _value = '';

  @override
  String get value => _value;

  @override
  set value(String next) => _value = next;

  @override
  void load() {}
}

class A {
  void load() {}
}

class B {
  void load() {}
}

enum Status { idle, loading }

mixin Loadable {
  void mixinLoad() {}
}

extension StringTools on String {
  String twice() => this + this;
}

typedef StringMapper = String Function(String value);
final topLevelValue = 'top'.twice();

String topLevel() => 'fixture';

void exercise() {
  final repository = MemoryRepository();
  repository.load();
  repository.value = topLevel();
  A().load();
  B().load();
  print(Status.loading);
  print(topLevelValue);
}
