type Row = Record<string, unknown>;

type QueryFilter = { field: string; value: unknown };

class MockDocSnapshot {
  constructor(private readonly value: Row | undefined) {}
  get exists() {
    return Boolean(this.value);
  }
  data() {
    return this.value;
  }
}

class MockQuerySnapshot {
  constructor(public readonly docs: Array<{ id: string; data: () => Row; ref: MockDocRef }>) {}
  get empty() {
    return this.docs.length === 0;
  }
}

class MockDocRef {
  constructor(
    private readonly store: Map<string, Map<string, Row>>,
    private readonly collectionName: string,
    public readonly id: string,
  ) {}

  async get() {
    const c = this.store.get(this.collectionName);
    return new MockDocSnapshot(c?.get(this.id));
  }

  async set(payload: Row, opts?: { merge?: boolean }) {
    const c = this.store.get(this.collectionName) ?? new Map<string, Row>();
    const prev = c.get(this.id) ?? {};
    c.set(this.id, opts?.merge ? { ...prev, ...payload } : payload);
    this.store.set(this.collectionName, c);
  }

  async update(payload: Row) {
    const c = this.store.get(this.collectionName);
    if (!c?.has(this.id)) throw new Error(`NOT_FOUND: ${this.collectionName}/${this.id}`);
    await this.set(payload, { merge: true });
  }

  async create(payload: Row) {
    if (this.store.get(this.collectionName)?.has(this.id)) {
      throw new Error(`ALREADY_EXISTS: ${this.collectionName}/${this.id}`);
    }
    await this.set(payload);
  }
}

/**
 * Transacción simulada: lecturas inmediatas y escrituras en búfer que se
 * aplican al final (como Firestore: si la función lanza, no se escribe nada).
 */
class MockTransaction {
  private readonly writes: Array<() => Promise<void>> = [];

  async get(ref: MockDocRef | MockQuery) {
    return ref.get();
  }

  set(ref: MockDocRef, payload: Row, opts?: { merge?: boolean }) {
    this.writes.push(() => ref.set(payload, opts));
    return this;
  }

  update(ref: MockDocRef, payload: Row) {
    this.writes.push(() => ref.update(payload));
    return this;
  }

  create(ref: MockDocRef, payload: Row) {
    this.writes.push(() => ref.create(payload));
    return this;
  }

  async commit() {
    for (const w of this.writes) await w();
  }
}

class MockQuery {
  private filters: QueryFilter[] = [];
  private take = Number.POSITIVE_INFINITY;

  constructor(
    protected readonly store: Map<string, Map<string, Row>>,
    protected readonly collectionName: string,
  ) {}

  where(field: string, _op: string, value: unknown) {
    this.filters.push({ field, value });
    return this;
  }

  limit(n: number) {
    this.take = n;
    return this;
  }

  async get() {
    const c = this.store.get(this.collectionName) ?? new Map<string, Row>();
    const rows = [...c.entries()]
      .filter(([, row]) => this.filters.every((f) => row[f.field] === f.value))
      .slice(0, this.take)
      .map(([id, row]) => ({
        id,
        data: () => row,
        ref: new MockDocRef(this.store, this.collectionName, id),
      }));
    return new MockQuerySnapshot(rows);
  }
}

class MockCollectionRef extends MockQuery {
  constructor(store: Map<string, Map<string, Row>>, collectionName: string) {
    super(store, collectionName);
  }

  doc(id?: string) {
    const nextId = id ?? `doc_${Math.random().toString(36).slice(2, 10)}`;
    return new MockDocRef(this.store, this.collectionName, nextId);
  }

  async add(payload: Row) {
    const ref = this.doc();
    await ref.set({ id: ref.id, ...payload });
    return ref;
  }
}

export class MockFirestore {
  private readonly store = new Map<string, Map<string, Row>>();
  /** Cola que serializa transacciones: simula el aislamiento de Firestore. */
  private txQueue: Promise<unknown> = Promise.resolve();

  runTransaction<T>(fn: (tx: MockTransaction) => Promise<T>): Promise<T> {
    const run = this.txQueue.then(async () => {
      const tx = new MockTransaction();
      const result = await fn(tx);
      await tx.commit();
      return result;
    });
    this.txQueue = run.catch(() => undefined);
    return run;
  }

  collection(name: string) {
    if (!this.store.has(name)) this.store.set(name, new Map<string, Row>());
    return new MockCollectionRef(this.store, name);
  }

  seed(collection: string, id: string, row: Row) {
    const c = this.store.get(collection) ?? new Map<string, Row>();
    c.set(id, row);
    this.store.set(collection, c);
  }

  all(collection: string): Row[] {
    return [...(this.store.get(collection)?.values() ?? [])];
  }
}

export function createMockFirestore() {
  return new MockFirestore();
}

