# Flutter Reference --- Product & Engineering Roadmap

> **Mục tiêu:** xây dựng một VS Code extension cho Dart/Flutter cung cấp
> trải nghiệm "Find Usages / References" trực quan tương tự
> IntelliJ/Android Studio: hiển thị số lượng usages ngay trên class,
> constructor, function, method, field, getter/setter, enum...; click để
> xem và điều hướng tới nơi sử dụng; sau đó mở rộng sang
> implementations, overrides, dead-code hints và các productivity
> CodeLens khác.
>
> **Tên làm việc:** `Flutter Reference`\
> **Nền tảng:** VS Code trên macOS / Windows / Linux\
> **Ngôn ngữ extension:** TypeScript\
> **Nguyên tắc:** không tự grep source code nếu language service có thể
> trả semantic references.

---

## 1. Product vision

Flutter Reference không nên chỉ là extension hiển thị một con số. Mục
tiêu dài hạn là tạo một lớp **code intelligence bổ sung cho Dart/Flutter
trong VS Code**, giúp developer hiểu nhanh:

```text
12 usages · 2 implementations
class ProductRepository

5 usages · 1 override
Future<List<Product>> getProducts()

0 usages
void legacyLoadProducts()
```

Developer không cần liên tục:

- Right click → Find All References.
- Search tên function bằng text.
- Mở nhiều file để kiểm tra function còn được sử dụng hay không.
- Chuyển sang IntelliJ chỉ vì CodeLens/usages tốt hơn.

### 1.1 Core value

Ba giá trị chính:

1.  **Visibility** --- nhìn code là biết symbol quan trọng tới mức nào.
2.  **Navigation** --- click một lần để tới usages/implementations.
3.  **Code health** --- phát hiện symbol 0 usages, code cũ và API ít
    được sử dụng.

### 1.2 Không làm ở giai đoạn đầu

Không biến extension thành:

- Dart formatter.
- Dart linter thay cho analyzer.
- State-management analyzer.
- Flutter widget inspector.
- Một Dart Language Server mới.

Flutter Reference phải **bổ sung** cho Dart tooling hiện có thay vì cạnh
tranh với nó.

---

# 2. User experience mục tiêu

## 2.1 Class

```dart
// 12 usages · 2 implementations
abstract class ProductRepository {
}
```

## 2.2 Function

```dart
// 7 usages
Future<List<Product>> loadProducts() async {
}
```

## 2.3 Method

```dart
class ProductService {

  // 4 usages
  Future<Product> getProduct(String id) async {
  }
}
```

## 2.4 Constructor

```dart
// 8 usages
ProductCard({
  required this.product,
});
```

## 2.5 Field

```dart
// 5 usages
final ProductRepository repository;
```

Field/variable nên có thể tắt vì số CodeLens có thể quá nhiều.

## 2.6 Zero usages

```dart
// 0 usages
void oldCheckoutFlow() {
}
```

Không mặc định kết luận đây là dead code. Một symbol có thể được gọi
gián tiếp, thông qua generated code, reflection-like mechanisms,
framework conventions hoặc external package API.

UI nên dùng wording an toàn:

```text
0 usages
```

thay vì:

```text
Unused / Dead code
```

## 2.7 Click interaction

Click:

```text
7 usages
```

→ gọi reference navigation/peek UI của VS Code.

Mục tiêu là tận dụng UI native thay vì tự xây một modal mới trong v0.x.

---

# 3. Technical architecture

```text
┌─────────────────────────────────────┐
│ VS Code                             │
│                                     │
│ Dart document                       │
│        │                            │
│        ▼                            │
│ Symbol Discovery                    │
│        │                            │
│        ▼                            │
│ CodeLensProvider                    │
│        │                            │
│        ▼                            │
│ Lazy CodeLens Resolver              │
│        │                            │
│        ▼                            │
│ Reference / Implementation Provider │
│        │                            │
│        ▼                            │
│ Cache                               │
│        │                            │
│        ▼                            │
│ Native VS Code navigation           │
└─────────────────────────────────────┘
```

## 3.1 Layers

Nên chia extension thành các layer rõ ràng.

```text
src/
├── extension.ts
│
├── core/
│   ├── config/
│   ├── cache/
│   ├── logger/
│   └── types/
│
├── dart/
│   ├── symbols/
│   ├── references/
│   ├── implementations/
│   └── hierarchy/
│
├── codelens/
│   ├── dartCodeLensProvider.ts
│   ├── codeLensResolver.ts
│   ├── codeLensFactory.ts
│   └── codeLensFormatter.ts
│
├── commands/
│   ├── showReferences.ts
│   ├── showImplementations.ts
│   ├── refreshReferences.ts
│   └── clearCache.ts
│
├── cache/
│   ├── referenceCache.ts
│   └── cacheKey.ts
│
├── events/
│   ├── documentEvents.ts
│   └── workspaceEvents.ts
│
└── utils/
```

Không cần tạo toàn bộ folder ngay ngày đầu. Đây là target architecture
để tránh `extension.ts` phình thành vài nghìn dòng.

---

# 4. Semantic reference strategy

Đây là quyết định kỹ thuật quan trọng nhất.

## 4.1 Không dùng grep làm source of truth

Ví dụ:

```dart
class ProductService {
  void load() {}
}

class UserService {
  void load() {}
}
```

Search text `load` không biết call nào thuộc method nào.

Ngoài ra còn:

- import alias;
- inherited method;
- extension methods;
- override;
- local variables trùng tên;
- getter/setter;
- generated source;
- constructor;
- library/private symbol.

Do đó reference count phải dựa trên **semantic information**.

## 4.2 Preferred pipeline

Ưu tiên tận dụng language features mà Dart extension/Dart Analysis
Server expose thông qua VS Code.

Conceptually:

```text
symbol position
      ↓
VS Code language command/API
      ↓
reference provider
      ↓
Location[]
      ↓
normalize
      ↓
exclude declaration if required
      ↓
count
```

### Spike bắt buộc trước khi code production

Trước Phase 1 cần làm một technical spike để xác nhận:

- Có thể lấy document symbols ổn định cho Dart không?
- Có thể gọi semantic references từ extension khác thông qua VS Code
  API/commands không?
- Declaration có nằm trong kết quả references không?
- Constructor behavior?
- Getter/setter behavior?
- Private symbols?
- Cross-package references?
- Monorepo?
- Generated `.g.dart`?
- File ngoài workspace?

Nếu API hiện tại không đủ, mới nghiên cứu integration sâu hơn với Dart
Analysis Server/LSP.

**Không thiết kế production architecture dựa trên assumption chưa kiểm
chứng.**

---

# 5. Performance architecture

Đây là phần quyết định extension có dùng được trong project Flutter thật
hay không.

Giả sử file có:

```text
80 methods
20 fields
10 classes
```

Nếu mỗi lần user gõ một ký tự đều chạy hơn 100 workspace-wide reference
queries thì extension sẽ gây lag.

## 5.1 Lazy CodeLens

Pipeline:

```text
open document
     ↓
discover symbols
     ↓
create unresolved CodeLens
     ↓
VS Code requests visible/needed lens
     ↓
resolveCodeLens()
     ↓
lookup cache
     ↓
cache miss?
 ┌───┴────┐
 no       yes
 │         │
return    query references
           ↓
          cache
           ↓
          render
```

## 5.2 Cache key

Không chỉ cache bằng symbol name.

Có thể bắt đầu với:

```text
documentUri
symbolRange/start position
symbolKind
documentVersion
```

Sau này có thể thêm workspace/revision information.

## 5.3 Invalidation

Invalidate khi:

- document thay đổi;
- document save;
- referenced file thay đổi;
- file create/delete/rename;
- configuration thay đổi;
- workspace folders thay đổi.

Không nhất thiết invalidate toàn bộ cache cho mọi keystroke.

## 5.4 Debounce

Document edits:

```text
edit
edit
edit
edit
     ↓
  debounce
     ↓
refresh
```

Mốc ban đầu để benchmark:

```text
300–800 ms
```

Không hard-code thành performance truth; benchmark rồi chọn.

## 5.5 Concurrency control

Không cho 100 reference queries chạy đồng thời.

Thiết kế queue:

```text
ReferenceQueryQueue
maxConcurrency = configurable/internal
```

Ưu tiên:

1.  visible editor;
2.  symbols đang resolve;
3.  background refresh.

## 5.6 Cancellation

Mọi operation dài nên hỗ trợ cancellation khi API cho phép.

Ví dụ user:

```text
Product A → Product B → Product C
```

Không nên tiếp tục tính CodeLens cho A/B nếu kết quả không còn cần
thiết.

---

# 6. Configuration design

Target settings:

```json
{
  "flutterReference.enabled": true,
  "flutterReference.showClasses": true,
  "flutterReference.showConstructors": true,
  "flutterReference.showMethods": true,
  "flutterReference.showFunctions": true,
  "flutterReference.showFields": false,
  "flutterReference.showVariables": false,
  "flutterReference.showEnums": true,
  "flutterReference.showExtensions": true,
  "flutterReference.showZeroUsages": true,
  "flutterReference.showImplementations": true,
  "flutterReference.excludeGeneratedFiles": true
}
```

Performance settings chỉ expose nếu user thật sự cần chỉnh:

```json
{
  "flutterReference.cache.enabled": true,
  "flutterReference.performance.maxConcurrentQueries": 4
}
```

Tránh đưa quá nhiều knobs ở version đầu.

---

# 7. Roadmap tổng thể

```text
Phase 0  Research + technical spike
   ↓
Phase 1  Extension skeleton
   ↓
Phase 2  Symbol discovery
   ↓
Phase 3  Reference engine
   ↓
Phase 4  CodeLens MVP
   ↓
Phase 5  Navigation
   ↓
Phase 6  More Dart symbols
   ↓
Phase 7  Cache + performance
   ↓
Phase 8  Implementations + hierarchy
   ↓
Phase 9  Code-health intelligence
   ↓
Phase 10 Testing + compatibility
   ↓
Phase 11 UX + settings
   ↓
Phase 12 Packaging + Marketplace
   ↓
Phase 13 Production hardening
   ↓
Phase 14 Advanced roadmap
```

---

# 8. Phase 0 --- Research & technical spike

**Mục tiêu:** loại bỏ các rủi ro kỹ thuật trước khi xây extension.

## Tasks

- Nghiên cứu VS Code Extension API.
- Nghiên cứu `CodeLensProvider`.
- Nghiên cứu `provideCodeLenses`.
- Nghiên cứu `resolveCodeLens`.
- Nghiên cứu DocumentSymbol API.
- Nghiên cứu References Provider/VS Code execute commands.
- Nghiên cứu Implementation Provider.
- Kiểm tra tương tác với official Dart extension.
- Tạo project Flutter sandbox.

Sandbox:

```text
example_flutter/
├── lib/
│   ├── main.dart
│   ├── product/
│   │   ├── product.dart
│   │   ├── product_repository.dart
│   │   ├── product_repository_impl.dart
│   │   └── product_service.dart
│   └── shared/
└── test/
```

Cases:

```text
class
abstract class
constructor
named constructor
top-level function
method
static method
field
getter
setter
enum
extension
mixin
typedef
override
implementation
private symbol
local variable
```

## Deliverable

Một `docs/technical-spike.md` ghi:

- API nào hoạt động.
- API nào không.
- shape của result.
- edge cases.
- performance sơ bộ.
- architectural decision.

## Exit criteria

Chỉ qua phase tiếp theo khi chứng minh được:

```text
Dart symbol
   ↓
semantic reference locations
   ↓
correct count
```

trên sandbox.

---

# 9. Phase 1 --- Bootstrap VS Code extension

## Stack

```text
Node.js LTS
TypeScript
VS Code Extension API
ESLint
Prettier
Vitest hoặc test framework phù hợp
GitHub Actions
```

## Project

```text
flutter-reference/
├── .github/
│   └── workflows/
├── .vscode/
├── docs/
├── src/
│   └── extension.ts
├── test/
├── package.json
├── tsconfig.json
├── eslint.config.*
├── README.md
├── CHANGELOG.md
├── LICENSE
└── .gitignore
```

## Initial activation

Extension chỉ activate khi hợp lý, ví dụ Dart workspace/document, thay
vì activate vô điều kiện.

## Commands

Ban đầu:

```text
Flutter Reference: Enable
Flutter Reference: Disable
Flutter Reference: Refresh
Flutter Reference: Clear Cache
```

## Exit criteria

- `F5` chạy Extension Development Host.
- Dart file được detect.
- extension log hoạt động.
- command hoạt động.
- không ảnh hưởng non-Dart files.

---

# 10. Phase 2 --- Symbol Discovery Engine

Mục tiêu: xác định chính xác những symbol nào cần CodeLens.

Interface gợi ý:

```ts
interface DartSymbol {
  name: string;
  kind: SymbolKind;
  uri: Uri;
  range: Range;
  selectionRange: Range;
}
```

Pipeline:

```text
Dart document
   ↓
Document Symbols
   ↓
recursive flatten
   ↓
filter supported SymbolKind
   ↓
normalize
   ↓
DartSymbol[]
```

Phải hỗ trợ nested symbol:

```dart
class ProductService {
  Future<void> load() {}
}
```

`load()` nằm bên trong class symbol.

## Phase 2.1 support

Chỉ:

- class;
- top-level function;
- method.

## Phase 2.2

Thêm:

- constructor;
- field;
- enum;
- getter/setter.

## Phase 2.3

Nghiên cứu:

- extension;
- mixin;
- typedef;
- local variable.

Không ép tất cả vào MVP nếu language symbol data không ổn định.

## Tests

Test fixture phải có symbol trùng tên:

```dart
class A {
  void load() {}
}

class B {
  void load() {}
}
```

## Exit criteria

Symbol engine trả đúng vị trí declaration và kind cho fixture.

---

# 11. Phase 3 --- Reference Engine

Tách reference logic khỏi CodeLens.

Interface:

```ts
interface ReferenceService {
  findReferences(symbol: DartSymbol): Promise<ReferenceResult>;
}
```

Result:

```ts
interface ReferenceResult {
  declaration: Location;
  references: Location[];
  count: number;
}
```

## Normalization

Phải quyết định rõ:

> `1 usage` có tính declaration không?

UX kiểu IntelliJ thường người dùng quan tâm **usage**, nên declaration
không nên được tính là usage nếu provider trả nó.

Ví dụ:

```dart
void foo() {}

void main() {
  foo();
  foo();
}
```

Expected:

```text
2 usages
```

không phải `3`.

## Duplicate locations

Deduplicate bằng:

```text
URI + range
```

## Generated files

Có policy:

```text
include generated
exclude generated
```

Default nên cân nhắc exclude các pattern phổ biến:

```text
*.g.dart
*.freezed.dart
*.gr.dart
*.mocks.dart
```

Nhưng cần setting vì generated references đôi khi có ý nghĩa.

## Exit criteria

Reference count chính xác trên fixture cho class/function/method.

---

# 12. Phase 4 --- CodeLens MVP

Đây là milestone đầu tiên có thể dùng hàng ngày.

Implement:

```ts
class DartReferenceCodeLensProvider
  implements vscode.CodeLensProvider
```

## `provideCodeLenses`

Chỉ:

1.  lấy symbols;
2.  filter;
3.  tạo unresolved lenses.

Không chạy toàn bộ references ngay tại đây nếu tránh được.

## `resolveCodeLens`

```text
resolve
  ↓
cache?
  ├─ yes → render
  └─ no
       ↓
     reference service
       ↓
     cache
       ↓
     render
```

Text:

```text
0 usages
1 usage
2 usages
```

## MVP scope

```text
class
function
method
```

Không thêm mọi feature trước khi MVP performance tốt.

## Exit criteria

Mở một Flutter project thật và nhìn thấy:

```text
7 usages
Future<void> loadProducts()
```

mà editor vẫn mượt.

---

# 13. Phase 5 --- Navigation & Peek References

Click `N usages` phải hữu ích.

Preferred behavior:

```text
click
  ↓
native references UI
  ↓
preview usages
  ↓
click location
  ↓
jump to source
```

## Zero usages

`0 usages` có thể:

- không clickable;
- hoặc chạy references để confirm/refresh.

MVP nên giữ behavior đơn giản.

## Commands

Internal command:

```text
flutterReference.showReferences
```

Arguments nên chứa semantic location thay vì chỉ symbol name.

Không làm:

```text
showReferences("load")
```

Nên gần:

```text
showReferences(uri, position)
```

## Exit criteria

Click CodeLens mở đúng references kể cả hai class có method cùng tên.

---

# 14. Phase 6 --- Full Dart Symbol Coverage

Mở rộng từng loại và test riêng.

Priority:

### P0

- class
- function
- method
- constructor

### P1

- field
- getter
- setter
- enum
- enum member
- extension
- mixin

### P2

- typedef
- top-level variable
- local variable

Local variable có nguy cơ gây visual noise rất cao nên mặc định có thể
tắt.

## Flutter-specific cases

Test:

```dart
class ProductCard extends StatelessWidget
```

và:

```dart
const ProductCard({
  super.key,
  required this.product,
});
```

Cũng test:

```dart
ConsumerWidget
StatefulWidget
State<T>
ChangeNotifier
Bloc
Cubit
Provider
Riverpod
```

Extension không cần hiểu state manager để reference count hoạt động,
nhưng fixture nên đại diện code Flutter thực tế.

---

# 15. Phase 7 --- Performance & Cache

Chỉ sau khi correctness ổn mới tối ưu sâu.

## Metrics cần đo

- activation time;
- provideCodeLenses duration;
- resolve duration;
- cache hit rate;
- query count;
- memory;
- CPU khi edit;
- behavior với file lớn.

## Test workspace

Tạo ít nhất:

```text
small:   < 100 Dart files
medium:  500–1,000 files
large:   3,000+ files
```

Ngoài synthetic project, test ít nhất một Flutter production project
thật.

## Cache

```text
ReferenceCache
├── get()
├── set()
├── invalidateDocument()
├── invalidateUri()
├── clear()
└── stats()
```

Có TTL nếu cần, nhưng correctness khi source thay đổi quan trọng hơn
TTL.

## Refresh policy

Không refresh toàn workspace mỗi keystroke.

Ví dụ:

```text
document edit
     ↓
invalidate affected document
     ↓
debounce
     ↓
fire CodeLens refresh
```

## Performance budget ban đầu

Các con số là target để benchmark, không phải guarantee:

```text
extension activation: không tạo cảm giác chậm
cached lens: gần như tức thời
editing: không gây visible jank
CPU idle: gần 0
```

Nếu reference query quá đắt, ưu tiên visible symbols hoặc chỉ resolve
CodeLens khi VS Code yêu cầu.

---

# 16. Phase 8 --- Implementations, Overrides & Hierarchy

Sau usages:

```text
7 usages · 2 implementations
abstract class ProductRepository
```

## Implementations

Đặc biệt hữu ích:

```dart
abstract class PaymentGateway {
  Future<void> pay();
}
```

UI:

```text
4 usages · 3 implementations
```

Click `3 implementations` → native implementation navigation.

## Overrides

Target:

```text
5 usages · overridden by 2
void dispose()
```

Hoặc:

```text
↑ overrides
↓ 2 overrides
```

Nhưng chỉ thêm nếu semantic API trả kết quả đáng tin cậy.

## Call hierarchy

Future:

```text
3 callers
5 callees
```

Không nhồi tất cả lên một CodeLens mặc định.

---

# 17. Phase 9 --- Code Health Intelligence

## 17.1 Zero usages

```text
0 usages
void legacyFunction()
```

Có thể giúp developer phát hiện code cần review.

Nhưng không auto-delete.

## 17.2 Public API warning

Nếu symbol public nhưng 0 internal usages:

```text
0 internal usages
```

không đồng nghĩa unused vì package khác có thể sử dụng.

## 17.3 Test-only usages

Feature hay:

```text
3 usages · tests only
```

Ví dụ symbol chỉ được gọi trong:

```text
test/
integration_test/
```

## 17.4 Generated-only usages

```text
2 usages · generated only
```

## 17.5 Reference breakdown

Future:

```text
12 usages
  7 production
  4 tests
  1 generated
```

Đây là feature khác biệt đáng giá so với một counter đơn giản.

---

# 18. Phase 10 --- Testing Strategy

Extension liên quan language intelligence phải có test nghiêm túc.

## 18.1 Unit tests

Test:

- symbol filtering;
- reference normalization;
- declaration exclusion;
- deduplication;
- pluralization;
- cache;
- config;
- generated-file classification.

## 18.2 Integration tests

Chạy VS Code Extension Host với Dart fixture.

Cases:

```text
class referenced from another file
function referenced twice
same method name in different classes
constructor
named constructor
override
abstract implementation
getter
setter
private symbol
generated file
test reference
```

## 18.3 Regression tests

Mỗi bug semantic phải có fixture trước khi fix.

Ví dụ bug:

```text
named constructor counted as class reference
```

→ thêm fixture vĩnh viễn.

## 18.4 Performance regression

Có benchmark script/project để tránh version mới làm:

```text
500ms → 5s
```

mà không phát hiện.

---

# 19. Phase 11 --- UX & Developer Settings

## Settings groups

### General

```text
enabled
```

### Symbols

```text
showClasses
showFunctions
showMethods
showConstructors
showFields
showVariables
...
```

### References

```text
showZeroUsages
excludeGeneratedFiles
```

### Advanced

```text
maxConcurrentQueries
debugLogging
```

## Commands

Command Palette:

```text
Flutter Reference: Enable
Flutter Reference: Disable
Flutter Reference: Refresh Current File
Flutter Reference: Clear Cache
Flutter Reference: Open Settings
Flutter Reference: Show Diagnostics
```

## Status bar

Không cần status bar mặc định nếu không có giá trị liên tục.

Có thể chỉ hiển thị khi:

- indexing;
- error;
- diagnostics mode.

Tránh làm UI rối.

---

# 20. Phase 12 --- Packaging & Distribution

## Local macOS

Build `.vsix`:

```text
flutter-reference-x.y.z.vsix
```

Install:

```bash
code --install-extension flutter-reference-x.y.z.vsix
```

Không cần Swift/Xcode/native macOS code cho extension thông thường.

## Marketplace

Chuẩn bị:

```text
README
CHANGELOG
LICENSE
icon
publisher
repository
bugs URL
categories
keywords
screenshots/GIF
privacy statement nếu cần
```

Keywords:

```text
dart
flutter
references
usages
codelens
intellij
productivity
navigation
```

README cần GIF:

```text
open Dart file
→ 7 usages appears
→ click
→ references panel opens
→ jump to file
```

---

# 21. Phase 13 --- Production Hardening

Phải test:

- VS Code stable.
- macOS Apple Silicon.
- macOS Intel nếu có thể.
- Windows.
- Linux.
- Flutter stable.
- nhiều Dart SDK versions hợp lý.
- monorepo.
- Melos workspace.
- nested packages.
- package symlinks.
- large generated codebase.

## Failure behavior

Nếu Dart language service chưa ready:

Không crash.

Có thể:

```text
hide lenses
```

và retry khi language features ready.

## Logging

Levels:

```text
error
warn
info
debug
trace
```

Default không spam Output panel.

## Diagnostics command

Rất hữu ích khi user report bug:

```text
Flutter Reference: Show Diagnostics
```

Output:

```text
Extension version
VS Code version
OS
Dart extension detected
Flutter extension detected
Workspace size
Configuration
Cache stats
Recent internal errors
```

Không thu source code hoặc sensitive data ngoài ý muốn.

---

# 22. Phase 14 --- Advanced Product Roadmap

Khi reference engine đã ổn, có thể biến project thành **Dart/Flutter
productivity intelligence extension**.

## 22.1 Reference heat

```text
128 usages · high impact
class ApiClient
```

Giúp developer biết sửa symbol này có blast radius lớn.

## 22.2 Change impact

Khi cursor ở:

```dart
ProductRepository
```

command:

```text
Flutter Reference: Analyze Change Impact
```

trả:

```text
24 direct usages
5 tests
3 implementations
8 feature modules affected
```

## 22.3 Module usage

```text
ProductRepository

Used by:
- product
- cart
- checkout
- home
```

Rất hữu ích cho Clean Architecture/project lớn.

## 22.4 Test coverage relationship

Không thay coverage tool, nhưng map semantic usage:

```text
12 production usages
4 test usages
```

## 22.5 Git-aware CodeLens

Có thể nghiên cứu:

```text
12 usages · changed 3d ago
```

nhưng nên là optional feature/module, không làm core extension phụ thuộc
Git.

## 22.6 Dependency graph

Future command:

```text
Flutter Reference: Show Dependency Graph
```

Visual:

```text
ProductBloc
   ↓
GetProducts
   ↓
ProductRepository
   ↓
ProductRepositoryImpl
   ↓
ProductApi
```

Đây có thể trở thành feature lớn riêng.

---

# 23. Milestone releases

## v0.0.1 --- Spike

Internal only.

```text
✓ Dart detection
✓ document symbols
✓ reference query experiment
```

## v0.1.0 --- Usages MVP

```text
✓ class
✓ function
✓ method
✓ N usages CodeLens
✓ click → references
```

Đây là release đầu tiên có giá trị.

## v0.2.0 --- Dart coverage

```text
✓ constructor
✓ field
✓ getter/setter
✓ enum
✓ settings
```

## v0.3.0 --- Performance

```text
✓ lazy resolution
✓ cache
✓ invalidation
✓ debounce
✓ query queue
✓ cancellation where possible
```

## v0.4.0 --- Implementations

```text
✓ implementation count
✓ navigation
✓ abstract/interface cases
```

## v0.5.0 --- Code health

```text
✓ zero usages
✓ test-only
✓ generated-only
```

## v0.6.x --- Hardening

```text
✓ monorepo
✓ Melos
✓ large projects
✓ regression suite
```

## v1.0.0

Chỉ release 1.0 khi:

- reference count đáng tin cậy;
- performance tốt trên production Flutter project;
- không gây editor jank;
- cache invalidation ổn;
- navigation ổn;
- settings/documentation đầy đủ;
- test suite bảo vệ core behavior;
- macOS/Windows/Linux đã được kiểm chứng hợp lý.

---

# 24. Definition of Done cho mỗi feature

Một feature chỉ Done khi có:

```text
[ ] implementation
[ ] semantic correctness tests
[ ] edge-case tests
[ ] error handling
[ ] cancellation/performance consideration
[ ] configuration nếu cần
[ ] documentation
[ ] changelog
[ ] manual test trên Flutter project thật
```

Không merge chỉ vì "happy path chạy được".

---

# 25. Coding principles

## 25.1 Correctness before cleverness

Reference count sai nguy hiểm hơn không hiển thị.

Nếu không chắc:

```text
hide / unresolved
```

tốt hơn hiển thị số sai.

## 25.2 Semantic \> textual

```text
Dart analyzer/language service
```

luôn ưu tiên hơn:

```text
grep / regex
```

## 25.3 Lazy \> eager

Không tính mọi thứ chỉ vì có thể.

## 25.4 Native VS Code UX \> custom UI

Ưu tiên:

- CodeLens;
- Peek References;
- Go to References;
- Go to Implementations;
- Quick Pick;

trước khi tự xây WebView.

## 25.5 Zero idle cost

Khi user không thao tác:

```text
CPU ≈ idle
```

Không polling workspace liên tục.

---

# 26. Security & privacy

Extension này về nguyên tắc có thể chạy hoàn toàn local.

Mặc định:

```text
No source upload
No telemetry chứa source code
No external AI API
No hidden network requests
```

Nếu sau này thêm telemetry:

- opt-in/tuân thủ VS Code telemetry conventions;
- chỉ performance/error metadata cần thiết;
- không gửi source;
- document rõ ràng.

Nếu thêm AI feature trong tương lai, tách riêng
permission/configuration.

---

# 27. CI/CD

GitHub Actions tối thiểu:

```text
push / pull request
       ↓
install
       ↓
lint
       ↓
typecheck
       ↓
unit tests
       ↓
integration tests where practical
       ↓
package validation
```

Release:

```text
tag v0.x.x
   ↓
test
   ↓
build VSIX
   ↓
GitHub Release
   ↓
Marketplace publish
```

Không publish Marketplace trực tiếp từ arbitrary branch.

---

# 28. Branch & release strategy

Đủ dùng cho project cá nhân/open source:

```text
main
feature/*
fix/*
perf/*
docs/*
```

Conventional commits có thể dùng:

```text
feat:
fix:
perf:
refactor:
test:
docs:
chore:
```

SemVer:

```text
0.1.0 feature
0.1.1 bug fix
0.2.0 next feature group
1.0.0 stable contract
```

---

# 29. Issue templates

Bug report nên yêu cầu:

```text
VS Code version:
Flutter Reference version:
Dart extension version:
Flutter/Dart version:
OS:
Workspace type:
Expected:
Actual:
Minimal Dart example:
Logs:
```

Performance issue:

```text
Approx Dart file count:
Largest file:
Melos/monorepo:
Generated code:
CPU behavior:
When slowdown happens:
Diagnostics output:
```

---

# 30. Development workflow hằng ngày

```text
1. Chọn 1 behavior nhỏ
2. Viết fixture
3. Viết/điều chỉnh test
4. Implement
5. Run unit tests
6. Run Extension Host
7. Test sandbox
8. Test production Flutter project
9. Benchmark nếu chạm reference pipeline
10. Commit
```

Đặc biệt:

> Mọi thay đổi trong reference/cache/symbol engine phải được test trên
> code có symbol trùng tên.

---

# 31. Thứ tự triển khai khuyến nghị thực tế

Đừng bắt đầu bằng toàn bộ roadmap.

### Sprint 1

```text
project setup
Dart detection
symbol discovery
class/function/method
```

### Sprint 2

```text
semantic reference query
declaration exclusion
deduplication
correct reference count
```

### Sprint 3

```text
CodeLens
click → references
basic settings
```

Sau Sprint 3 phải có extension dùng được.

### Sprint 4

```text
constructor
field
getter/setter
enum
```

### Sprint 5

```text
cache
lazy resolve
debounce
query queue
performance benchmark
```

### Sprint 6

```text
implementations
navigation
abstract/interface tests
```

### Sprint 7

```text
zero usages
test/generated classification
diagnostics
```

### Sprint 8

```text
CI
docs
GIF/screenshots
VSIX
Marketplace beta
```

Sau đó dùng thật vài tuần trước khi đẩy v1.0.

---

# 32. Success metrics

Technical:

```text
Reference correctness      > feature count
No noticeable editor jank
Low idle CPU
Predictable cache behavior
Low crash/error rate
```

Product:

```text
Developer can understand usage without right-clicking
Clicking CodeLens reliably navigates to references
Extension remains useful on large Flutter projects
Settings prevent visual noise
```

Open-source/Marketplace sau này có thể theo dõi:

```text
installs
retention
GitHub stars
issues/week
performance complaints
reference correctness bugs
```

---

# 33. Final target

Flutter Reference v1 không cần clone toàn bộ IntelliJ.

Một v1 tốt chỉ cần làm cực tốt vòng lặp:

```text
WRITE CODE
    ↓
SEE USAGES
    ↓
UNDERSTAND IMPACT
    ↓
NAVIGATE
    ↓
REFACTOR SAFELY
```

Trải nghiệm mục tiêu:

```dart
// 18 usages · 2 implementations
abstract class ProductRepository {

  // 7 usages · 2 implementations
  Future<List<Product>> getProducts();

  // 3 usages
  Future<Product?> findById(String id);
}

// 0 usages
Future<void> legacySyncProducts() {}
```

Nếu phần này **nhanh, đúng và ổn định**, extension đã có giá trị thực
tế. Những feature như dependency graph, Git context, change-impact
analysis hay AI nên được xây trên nền semantic engine đó, không làm
trước core.

---

# 34. Checklist bắt đầu project ngay

```text
[ ] Tạo repository flutter-reference
[ ] Scaffold VS Code TypeScript extension
[ ] Cài official Dart + Flutter extensions trong dev environment
[ ] Tạo Flutter fixture project
[ ] Detect Dart documents
[ ] Experiment DocumentSymbol
[ ] Experiment semantic References
[ ] Ghi technical-spike.md
[ ] Implement DartSymbol abstraction
[ ] Implement ReferenceService
[ ] Test declaration exclusion
[ ] Test duplicate symbol names
[ ] Implement CodeLensProvider
[ ] Implement lazy resolver
[ ] Click → native references
[ ] Add class/function/method support
[ ] Benchmark
[ ] Add cache
[ ] Add invalidation
[ ] Add constructors/fields/getters/setters
[ ] Add implementations
[ ] Add zero-usages hints
[ ] Integration tests
[ ] CI
[ ] Package VSIX
[ ] Dogfood trên project Flutter production
[ ] Fix performance/correctness issues
[ ] Publish beta
[ ] Stabilize → v1.0
```

---

## Kết luận

**Flutter Reference nên được xây như một semantic developer tool, không
phải text-search extension.**

Ba ưu tiên xuyên suốt:

```text
1. CORRECTNESS
2. PERFORMANCE
3. UX
```

Architecture cần cho phép bắt đầu rất nhỏ với:

```text
N usages
```

nhưng không khóa đường phát triển tới:

```text
N usages
N implementations
override hierarchy
test/generated breakdown
change impact
dependency intelligence
```

Nếu giữ đúng nguyên tắc đó, project có thể đi từ một extension cá nhân
trên macOS thành một productivity tool thực sự hữu ích cho cộng đồng
Dart/Flutter trên VS Code.

---

# PHẦN II --- FLUTTER REFERENCE FOR AI AGENTS

> Mục tiêu tiếp theo: biến semantic intelligence của Flutter Reference
> thành machine-readable tools cho AI coding agents.
>
> ```text
> Flutter Reference → Semantic Intelligence → MCP / CLI / Agent Tools → Safe Refactoring
> ```

# 35. Tư tưởng cốt lõi

Không để AI kết luận một symbol thừa chỉ vì grep không tìm thấy.

Một symbol có `0 semantic references` vẫn có thể liên quan tới override,
callback, route, DI, annotation, generated code, test, Flutter
lifecycle, platform channel hoặc public package API.

Flow đúng:

```text
AI Agent
   ↓
Flutter Reference Agent Tool
   ↓
Dart semantic intelligence
   ↓
structured evidence
   ↓
risk assessment
   ↓
AI plan
```

# 36. Product vision

```text
Flutter Intelligence Engine
│
├── Human Intelligence
│   ├── usages CodeLens
│   ├── implementations
│   ├── overrides
│   └── hierarchy
│
└── Agent Intelligence
    ├── find references
    ├── find implementations
    ├── unused candidates
    ├── delete-safety analysis
    ├── change-impact analysis
    ├── related tests
    ├── dead-code clusters
    └── refactor verification
```

# 37. Architecture

```text
Dart Analyzer / Language Service
              │
              ▼
      Semantic Intelligence Core
      ├── Symbols
      ├── References
      ├── Implementations
      ├── Hierarchy
      ├── Symbol Graph
      ├── Impact Analysis
      └── Safety Analysis
              │
      ┌───────┼────────┐
      ▼       ▼        ▼
   VS Code    MCP      CLI
      │       │        │
   Human    Agents     CI
```

Core không phụ thuộc VS Code UI.

Target repository (extension-first distribution):

```text
flutter-reference/
├── packages/
│   ├── core/
│   │   └── src/
│   │       ├── symbols/
│   │       ├── references/
│   │       ├── implementations/
│   │       ├── hierarchy/
│   │       ├── graph/
│   │       ├── impact/
│   │       └── safety/
│   ├── vscode-adapter/
│   ├── vscode-extension/
│   ├── agent-bridge/
│   ├── mcp-server/
│   └── cli/
├── fixtures/
└── docs/
```

`vscode-extension`, MCP và CLI là ba consumer của cùng core. Bản phát
hành chính vẫn là một VSIX: MCP/CLI được bundle theo extension, nhưng
chỉ được cấu hình vào AI host sau khi user xác nhận.

MCP/CLI chạy process riêng và gọi semantic provider trong Extension
Host qua authenticated local IPC. Nếu Extension Host hoặc Dart language
service chưa sẵn sàng, phải trả `LANGUAGE_SERVICE_UNAVAILABLE`/partial;
không được fallback sang grep rồi gọi đó là semantic result.

# 38. Safety principle

Không tạo ngay:

```text
delete_unused_function()
```

Tạo:

```text
dart_find_unused_symbols
dart_analyze_delete_safety
```

Phân biệt rõ:

```text
0 semantic references ≠ safe to delete
```

Risk model:

```text
LOW
MEDIUM
HIGH
UNKNOWN
```

Khi evidence không đầy đủ phải trả `UNKNOWN`, không đoán `LOW`.

# 39. MCP v0.1 --- 5 tools đầu tiên

## `dart_find_references`

Input:

```json
{
  "file": "lib/features/product/product_service.dart",
  "line": 42,
  "column": 15
}
```

Output:

```json
{
  "symbol": { "name": "loadProducts", "kind": "method" },
  "referenceCount": 7,
  "references": []
}
```

Yêu cầu:

- semantic references;
- declaration-aware;
- deduplicate locations;
- include/exclude tests;
- include/exclude generated code.

## `dart_find_implementations`

Trả tất cả implementations/subclasses liên quan tới interface, abstract
class hoặc abstract method.

Agent phải gọi tool này trước khi thay đổi contract quan trọng.

## `dart_find_unused_symbols`

Input:

```json
{
  "scope": "lib/features/product",
  "kinds": ["class", "method", "function"]
}
```

Output phải gọi là `candidates`, không gọi là `deadCode`.

```json
{
  "candidates": [
    {
      "name": "legacyLoadProducts",
      "semanticReferences": 0,
      "confidence": 0.82
    }
  ]
}
```

## `dart_analyze_delete_safety`

Pipeline:

```text
references
+ implementations
+ overrides
+ call hierarchy
+ annotations
+ exports/public API
+ generated references
+ test references
+ framework rules
        ↓
risk assessment
```

Output:

```json
{
  "symbol": "legacyLoadProducts",
  "semanticReferences": 0,
  "implementations": 0,
  "overrides": 0,
  "testReferences": 0,
  "generatedReferences": 0,
  "publicApi": false,
  "risk": "LOW",
  "recommendation": "candidate_for_removal",
  "reasons": ["No semantic references found", "Private symbol", "No generated/test relationship found"]
}
```

Nếu public/generated/framework-driven:

```json
{
  "risk": "HIGH",
  "recommendation": "manual_review"
}
```

## `dart_analyze_change_impact`

Trước khi AI sửa API:

```json
{
  "symbol": "getProducts",
  "directReferences": 17,
  "implementations": 3,
  "overrides": 2,
  "affectedFiles": 14,
  "affectedFeatures": ["home", "product", "cart", "search"],
  "relatedTests": 6,
  "risk": "MEDIUM"
}
```

# 40. MCP v0.2 --- Context Intelligence

Thêm:

```text
dart_get_symbol_context
dart_find_related_tests
dart_verify_change
```

`dart_get_symbol_context` trả:

```text
Declaration
Implementations
Callers
Callees
References
Imports
Exports
Related tests
Related feature/module
```

Mục tiêu là để agent đọc 10 file semantic liên quan thay vì grep 2.000
file.

Tool output phải summary-first:

```json
{
  "summary": {
    "references": 124,
    "files": 38,
    "features": 6
  },
  "topReferences": [],
  "hasMore": true
}
```

# 41. `dart_verify_change`

Sau khi agent sửa/xóa:

```text
changed files
      ↓
semantic re-analysis
      ↓
dart analyze
      ↓
dangling reference checks
      ↓
related tests
      ↓
public API impact
```

Output:

```json
{
  "status": "PASS",
  "analyzerErrors": 0,
  "danglingReferences": 0,
  "relatedTests": {
    "total": 14,
    "passed": 14,
    "failed": 0
  },
  "verificationScope": "related_tests_only"
}
```

Không claim full verification nếu chỉ chạy subset tests.

# 42. Symbol Graph

Node:

```ts
interface SymbolNode {
  id: string;
  name: string;
  kind: SymbolKind;
  uri: string;
  range: SourceRange;
}
```

Edges:

```text
REFERENCES
CALLS
IMPLEMENTS
EXTENDS
OVERRIDES
IMPORTS
EXPORTS
TESTS
GENERATED_FROM
REGISTERED_BY
```

Ví dụ:

```text
ProductBloc
    ↓ CALLS
GetProducts
    ↓ REFERENCES
ProductRepository
    ↓ IMPLEMENTED_BY
ProductRepositoryImpl
    ↓ CALLS
ProductApi
```

Không dùng symbol name đơn thuần làm identity. Long-term cần qualified
semantic identity dựa trên package/library + symbol path + kind +
signature.

# 43. Dead-code analysis thực sự

Một cluster:

```text
LegacyBloc
    ↓
LegacyUseCase
    ↓
LegacyRepository
    ↓
LegacyApi
```

có thể reference lẫn nhau nên không symbol nào có `0 usages`, nhưng toàn
cluster không reachable từ application.

Cần:

```text
application roots
       ↓
graph traversal
       ↓
reachable nodes
       ↓
all nodes - reachable nodes
       ↓
dead-code candidates
```

Application roots có thể gồm:

```text
main()
runApp()
routes
GoRouter/AutoRoute
DI registrations
public exports
test entrypoints
background handlers
platform callbacks
annotated entrypoints
```

Không assume `main()` là root duy nhất.

# 44. Strongly Connected Components

Dùng Tarjan SCC hoặc Kosaraju:

```text
build directed graph
      ↓
find SCC
      ↓
collapse SCC
      ↓
reachability from roots
      ↓
unreachable components
```

Tool:

```text
dart_find_dead_code_clusters
```

Output:

```json
{
  "clusters": [
    {
      "id": "cluster_12",
      "rootCandidate": "LegacyCheckoutBloc",
      "symbols": 14,
      "files": 5,
      "estimatedLines": 734,
      "confidence": 0.91,
      "risk": "LOW"
    }
  ]
}
```

Ban đầu report-only, không auto-delete.

# 45. Framework Awareness Layer

Thiết kế plugin-like:

```text
FrameworkRuleProvider
├── FlutterFrameworkRules
├── RiverpodRules
├── BlocRules
├── GoRouterRules
├── AutoRouteRules
├── GetItRules
├── JsonSerializableRules
├── FreezedRules
└── MethodChannelRules
```

Provider có thể đóng góp:

```text
roots
implicit references
generated relationships
risk signals
```

Cẩn thận với:

```dart
@pragma('vm:entry-point')
```

và:

```text
build
initState
dispose
background handlers
MethodChannel callbacks
deep-link handlers
native callbacks
```

# 46. Generated/Public/Test awareness

Generated patterns:

```text
*.g.dart
*.freezed.dart
*.gr.dart
*.mocks.dart
```

Không chỉ exclude generated files; phải hiểu quan hệ source → generated.

Public package API:

```text
internalReferences: 0
publicApi: true
```

không được đánh safe-delete.

Phân loại references:

```text
production
test
integration_test
generated
```

Ví dụ:

```text
0 production usages · 5 test usages
```

# 47. Related Test + Architecture Intelligence

Khi sửa `ProductRepository.getProducts`, trả related tests:

```text
test/features/product/get_products_test.dart
test/features/home/home_bloc_test.dart
test/data/product_repository_test.dart
```

Có thể infer affected feature/module:

```text
Affected features:
- product
- cart
- checkout
```

Future tool:

```text
dart_analyze_architecture_impact
```

để phát hiện dependency-direction violations.

# 48. Agentic Refactoring Workflow

```text
User: "Clean dead code in product feature"
              ↓
Agent
 ├─ dart_find_dead_code_clusters
 ├─ dart_analyze_delete_safety
 ├─ dart_get_symbol_context
 ├─ create plan
 ├─ apply changes
 └─ dart_verify_change
              ↓
Final report
```

Policy:

```text
LOW     → có thể propose/apply tùy host permission
MEDIUM  → review recommended
HIGH    → explicit review strongly recommended
UNKNOWN → không auto-delete
```

# 49. MCP Server structure

```text
packages/mcp-server/
├── src/
│   ├── server.ts
│   ├── tools/
│   │   ├── findReferences.ts
│   │   ├── findImplementations.ts
│   │   ├── findUnusedSymbols.ts
│   │   ├── analyzeDeleteSafety.ts
│   │   └── analyzeChangeImpact.ts
│   └── schemas/
└── package.json
```

MCP chỉ:

```text
request → validate → core service → serialize
```

Không duplicate semantic algorithms.

Trong distribution extension-first, MCP server được đóng gói trong
VSIX và host AI launch qua stdio. MCP kết nối tới VS Code adapter bằng
local socket/named pipe có session token, protocol-version handshake,
timeout và giới hạn request. Không mở network port công khai.

Extension cung cấp command cấu hình có xác nhận:

```text
Flutter Reference: Configure MCP for Cursor
Flutter Reference: Configure MCP for Claude Code
Flutter Reference: Copy MCP Configuration
Flutter Reference: Check Agent Integration
Flutter Reference: Remove Agent Integration
```

Tool output mặc định summary-first, tối đa 20 locations/page, không kèm
source body và dùng opaque cursor để agent chỉ lấy thêm dữ liệu khi cần.

# 50. CLI + CI

CLI:

```bash
flutter-reference analyze-unused
flutter-reference impact lib/domain/product_repository.dart:15:20
flutter-reference dead-code --format json
flutter-reference verify --changed
```

CI:

```text
Pull Request
    ↓
Semantic Analyze
    ↓
Change Impact
    ↓
Potential Dead Code
    ↓
Architecture Impact
    ↓
PR Report
```

Experimental heuristic không block PR mặc định.

# 51. AI-friendly contracts

Tool output phải:

- deterministic;
- structured;
- concise;
- evidence-based;
- pagination-friendly;
- không dump source vô hạn.

Nên có:

```text
summary
evidence
risk
confidence
warnings
locations
nextActions
```

Confidence không thay thế evidence.

# 52. Error + partial-result model

Errors:

```text
SYMBOL_NOT_FOUND
LANGUAGE_SERVICE_UNAVAILABLE
WORKSPACE_NOT_INDEXED
UNSUPPORTED_SYMBOL
ANALYSIS_TIMEOUT
INTERNAL_ERROR
```

Analyzer fail không được trả `references: []`.

Partial:

```json
{
  "status": "PARTIAL",
  "complete": false,
  "referencesFound": 82
}
```

Rule:

```text
incomplete evidence → risk cannot be LOW
```

# 53. Performance / Indexing

Cache:

```text
Symbol Cache
Reference Cache
Implementation Cache
Graph Cache
Workspace Index Cache
```

Workspace index:

```text
workspace
   ↓
discover Dart files
   ↓
extract symbols
   ↓
build edges
   ↓
persist/cache
   ↓
incremental updates
```

States:

```text
NOT_INDEXED
INDEXING
READY
STALE
ERROR
```

Không rebuild toàn graph mỗi keystroke.

# 54. Multi-package / Melos

Hiểu:

```text
workspace
├── apps/mobile
├── packages/core
├── packages/design_system
└── packages/api
```

Impact:

```text
Changing core.Product

Affected packages:
- mobile
- checkout
- admin
```

Future:

```text
dart_get_package_dependency_graph
```

# 55. Safe Delete UX

Human-facing trước:

```text
Flutter Reference: Safe Delete
```

```text
Delete ProductService.oldLoad?

Semantic usages: 0
Overrides: 0
Implementations: 0
Tests: 0
Generated relationships: 0
Public API: No

Risk: LOW
```

Flow:

```text
analyze → evidence → confirm → edit → verify
```

Sau khi dogfood đủ mới mở agentic safe-delete.

# 56. Blast Radius

Signals:

```text
references
packages
public API
implementations
affected features
generated relationships
platform boundary
test relationships
```

Ví dụ:

```text
ApiClient.request()

References: 184
Features: 17
Packages: 6

Blast radius: CRITICAL
```

# 57. Human bridge trước MCP hoàn chỉnh

Command:

```text
Flutter Reference: Copy AI Context
```

Output:

```text
Symbol: ProductRepository
Implementations: ...
Consumers: ...
Related tests: ...
Change risk: ...
```

Developer paste vào Cursor/Claude/ChatGPT.

# 58. Security & Privacy

MCP mặc định:

```text
read-only semantic analysis
```

Không cần arbitrary shell/network/file deletion.

Default:

```text
No source upload
No external LLM call
No telemetry containing source
Local semantic processing
```

Tách analysis tools và execution tools.

# 59. Testing corpus

Fixtures:

```text
fixtures/
├── basic_references/
├── inheritance/
├── generated_code/
├── routing/
├── riverpod/
├── bloc/
├── get_it/
├── method_channel/
├── monorepo/
└── dead_code_graph/
```

Dead-code regression corpus phải có:

```text
truly unused private function
public API with zero internal refs
override with zero direct refs
route callback
DI registration
generated serialization
background handler
method channel callback
mutually-referencing unreachable cluster
```

Mỗi semantic bug mới phải thêm golden test.

# 60. Benchmark corpus

```text
S: 100 Dart files
M: 1,000 Dart files
L: 5,000+ Dart files
```

Measure:

```text
reference latency
unused scan latency
impact latency
graph build
incremental update
memory
```

# 61. Agent Roadmap

## Phase A0 --- Core Extraction

```text
[ ] Tách semantic logic khỏi VS Code UI
[ ] Core không import VS Code UI
[ ] Unit tests
[ ] Extension hiện tại vẫn hoạt động
```

## Phase A1 --- Agent Primitives

```text
[ ] dart_find_references
[ ] dart_find_implementations
[ ] Structured contracts
[ ] Fixtures
```

## Phase A2 --- MCP v0.1

```text
[ ] dart_find_references
[ ] dart_find_implementations
[ ] dart_find_unused_symbols
[ ] dart_analyze_delete_safety
[ ] dart_analyze_change_impact
[ ] Test bằng Cursor
```

## Phase A3 --- Context Intelligence

```text
[ ] dart_get_symbol_context
[ ] dart_find_related_tests
[ ] Benchmark MCP vs grep/search
```

## Phase A4 --- Verification

```text
[ ] dart_verify_change
[ ] dart analyze integration
[ ] related tests
[ ] semantic re-analysis
```

## Phase A5 --- Symbol Graph

```text
[ ] REFERENCES
[ ] CALLS
[ ] IMPLEMENTS
[ ] EXTENDS
[ ] OVERRIDES
[ ] IMPORTS
[ ] EXPORTS
[ ] incremental cache
```

## Phase A6 --- Dead-code Clusters

```text
[ ] application roots
[ ] reachability
[ ] SCC
[ ] unreachable components
[ ] risk rules
[ ] dart_find_dead_code_clusters
```

## Phase A7 --- Framework Rules

```text
[ ] Flutter core
[ ] GoRouter
[ ] Riverpod
[ ] Bloc
[ ] GetIt
[ ] json_serializable
[ ] Freezed
```

## Phase A8 --- CLI + CI

```text
[ ] references
[ ] unused
[ ] impact
[ ] dead-code
[ ] verify
[ ] PR report
```

## Phase A9 --- Safe Delete UX

```text
analyze → evidence → confirm → edit → verify
```

## Phase A10 --- Agentic Refactor

```text
Agent → analyze → plan → apply → verify
```

# 62. Version roadmap mới

```text
Flutter Reference v0.x
    usages / navigation / implementations

Semantic Core v1
    symbols / references / hierarchy

Agent Tools v0.1
    refs / implementations / unused / safety / impact

Agent Tools v0.2
    context / tests / verification

Intelligence v0.3
    symbol graph / dead-code clusters

Intelligence v0.4
    framework / architecture / monorepo

Intelligence v1.0
    production-safe semantic foundation
```

# 63. Definition of Done cho Agent Tool

```text
[ ] Semantic evidence
[ ] Structured schema
[ ] Input validation
[ ] Error model
[ ] Partial-result handling
[ ] Unit tests
[ ] Integration fixture
[ ] Performance measurement
[ ] Agent-friendly description
[ ] Documentation
[ ] No unsafe automatic assumption
```

Safety tools thêm:

```text
[ ] Framework edge cases
[ ] Public API handling
[ ] Generated code handling
[ ] Test handling
[ ] UNKNOWN state
```

# 64. Không nên làm

```text
✗ AI tự delete tất cả 0 usages
✗ grep == semantic reference
✗ 0 internal refs == dead public API
✗ analyzer error == zero refs
✗ partial result == complete
✗ confidence không evidence
✗ MCP duplicate core logic
```

# 65. Thứ tự ưu tiên ngay bây giờ

```text
1. Extract Semantic Core và portable contracts
2. VS Code semantic adapter
3. Authenticated local agent bridge
4. Bundled MCP stdio server
5. dart_find_references
6. dart_find_implementations
7. dart_find_unused_symbols
8. dart_analyze_delete_safety
9. dart_analyze_change_impact
10. Cursor/Claude configuration có user confirmation
11. dart_get_symbol_context
12. dart_verify_change
13. Symbol Graph
14. Dead-code clusters
```

# 66. MVP Agent Demo

Prompt:

```text
Review ProductService and remove code that is truly unnecessary.
Do not delete anything unless semantic analysis indicates it is a
low-risk removal candidate.
```

Expected:

```text
dart_find_unused_symbols
          ↓
legacyLoadProducts
          ↓
dart_analyze_delete_safety
          ↓
LOW risk
          ↓
Agent proposes/applies deletion
          ↓
dart_verify_change
          ↓
PASS
```

# 67. Change Impact Demo

Prompt:

```text
Change ProductRepository.getProducts() to return PaginatedProducts.
```

Expected:

```text
dart_analyze_change_impact
 ↓
3 implementations
17 references
4 affected features
6 related tests
 ↓
refactor plan
 ↓
edit
 ↓
dart_verify_change
```

# 68. Product positioning

```text
Flutter Reference
Semantic code intelligence for humans and AI agents working
with Dart & Flutter.
```

Không phải:

```text
another AI chatbot
another grep wrapper
regex dead-code detector
```

Mà là:

```text
semantic intelligence layer
```

# 69. Long-term moat

Giá trị dài hạn nằm ở:

```text
1. Semantic graph
2. Flutter framework rules
3. Dead-code regression corpus
4. Change-impact engine
5. Safe-delete engine
6. Agent-friendly contracts
```

# 70. North Star

Mục tiêu cuối **không phải**:

```text
AI có thể xóa code.
```

Mà là:

```text
AI hiểu tác động của code trước khi sửa nó.
```

Pipeline:

```text
Understand
    ↓
Find semantic relationships
    ↓
Assess impact
    ↓
Assess risk
    ↓
Plan
    ↓
Modify
    ↓
Verify
```

Flutter Reference khi đó trở thành một **semantic safety layer giữa AI
coding agent và Dart/Flutter codebase**.

```text
Flutter Reference
      ↓
Semantic Intelligence
      ↓
Agent Intelligence
      ↓
Safe Refactoring
```
