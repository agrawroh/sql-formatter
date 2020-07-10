import dedent from 'dedent-js';
import * as sqlFormatter from './../src/sqlFormatter';
import behavesLikeSqlFormatter from './behavesLikeSqlFormatter';

describe('PlSqlFormatter', function () {
  behavesLikeSqlFormatter('pl/sql');

  const format = (query, cfg = {}) => sqlFormatter.format(query, { ...cfg, language: 'pl/sql' });

  it('formats FETCH FIRST like LIMIT', () => {
    expect(format('SELECT col1 FROM tbl ORDER BY col2 DESC FETCH FIRST 20 ROWS ONLY;')).toBe(dedent`
      SELECT
        col1
      FROM
        tbl
      ORDER BY
        col2 DESC
      FETCH FIRST
        20 ROWS ONLY;

    `);
  });

  it('formats only -- as a line comment', () => {
    const result = format('SELECT col FROM\n-- This is a comment\nMyTable;\n');
    expect(result).toBe(dedent`
      SELECT
        col
      FROM
        -- This is a comment
        MyTable;

    `);
  });

  it('recognizes _, $, #, . and @ as part of identifiers', () => {
    const result = format('SELECT my_col$1#, col.2@ FROM tbl\n');
    expect(result).toBe(dedent`
      SELECT
        my_col$1#,
        col.2@
      FROM
        tbl

    `);
  });

  it('formats short CREATE TABLE', () => {
    expect(format('CREATE TABLE items (a INT PRIMARY KEY, b TEXT);')).toBe(
      'CREATE TABLE items (a INT PRIMARY KEY, b TEXT);\n'
    );
  });

  it('formats long CREATE TABLE', function () {
    expect(
      format('CREATE TABLE items (a INT PRIMARY KEY, b TEXT, c INT NOT NULL, d INT NOT NULL);')
    ).toBe(dedent`
      CREATE TABLE items (
        a INT PRIMARY KEY,
        b TEXT,
        c INT NOT NULL,
        d INT NOT NULL
      );

    `);
  });

  it('formats INSERT without INTO', () => {
    const result = format(
      "INSERT Customers (ID, MoneyBalance, Address, City) VALUES (12,-123.4, 'Skagen 2111','Stv');"
    );
    expect(result).toBe(dedent`
      INSERT
        Customers (ID, MoneyBalance, Address, City)
      VALUES
        (12, -123.4, 'Skagen 2111', 'Stv');

    `);
  });

  it('formats ALTER TABLE ... MODIFY query', () => {
    const result = format('ALTER TABLE supplier MODIFY supplier_name char(100) NOT NULL;');
    expect(result).toBe(dedent`
      ALTER TABLE
        supplier
      MODIFY
        supplier_name char(100) NOT NULL;

    `);
  });

  it('formats ALTER TABLE ... ALTER COLUMN query', () => {
    const result = format('ALTER TABLE supplier ALTER COLUMN supplier_name VARCHAR(100) NOT NULL;');
    expect(result).toBe(dedent`
      ALTER TABLE
        supplier
      ALTER COLUMN
        supplier_name VARCHAR(100) NOT NULL;

    `);
  });

  it('recognizes ?[0-9]* placeholders', () => {
    const result = format('SELECT ?1, ?25, ?;');
    expect(result).toBe(dedent`
      SELECT
        ?1,
        ?25,
        ?;

    `);
  });

  it('replaces ? numbered placeholders with param values', () => {
    const result = format('SELECT ?1, ?2, ?0;', {
      params: {
        0: 'first',
        1: 'second',
        2: 'third',
      },
    });
    expect(result).toBe(dedent`
      SELECT
        second,
        third,
        first;

    `);
  });

  it('replaces ? indexed placeholders with param values', () => {
    const result = format('SELECT ?, ?, ?;', {
      params: ['first', 'second', 'third'],
    });
    expect(result).toBe(dedent`
      SELECT
        first,
        second,
        third;

    `);
  });

  it('formats SELECT query with CROSS JOIN', () => {
    const result = format('SELECT a, b FROM t CROSS JOIN t2 on t.id = t2.id_t');
    expect(result).toBe(dedent`
      SELECT
        a,
        b
      FROM
        t
        CROSS JOIN t2 on t.id = t2.id_t

    `);
  });

  it('formats SELECT query with CROSS APPLY', () => {
    const result = format('SELECT a, b FROM t CROSS APPLY fn(t.id)');
    expect(result).toBe(dedent`
      SELECT
        a,
        b
      FROM
        t
        CROSS APPLY fn(t.id)

    `);
  });

  it('formats simple SELECT', () => {
    const result = format('SELECT N, M FROM t');
    expect(result).toBe(dedent`
      SELECT
        N,
        M
      FROM
        t

    `);
  });

  it('formats simple SELECT with national characters', () => {
    const result = format("SELECT N'value'");
    expect(result).toBe(dedent`
      SELECT
        N'value'

    `);
  });

  it('formats SELECT query with OUTER APPLY', () => {
    const result = format('SELECT a, b FROM t OUTER APPLY fn(t.id)');
    expect(result).toBe(dedent`
      SELECT
        a,
        b
      FROM
        t
        OUTER APPLY fn(t.id)

    `);
  });

  it('formats CASE ... WHEN with a blank expression', () => {
    const result = format(
      "CASE WHEN option = 'foo' THEN 1 WHEN option = 'bar' THEN 2 WHEN option = 'baz' THEN 3 ELSE 4 END;"
    );

    expect(result).toBe(dedent`
      CASE
        WHEN option = 'foo' THEN 1
        WHEN option = 'bar' THEN 2
        WHEN option = 'baz' THEN 3
        ELSE 4
      END;

    `);
  });

  it('formats CASE ... WHEN inside SELECT', () => {
    const result = format(
      "SELECT foo, bar, CASE baz WHEN 'one' THEN 1 WHEN 'two' THEN 2 ELSE 3 END FROM table"
    );

    expect(result).toBe(dedent`
      SELECT
        foo,
        bar,
        CASE
          baz
          WHEN 'one' THEN 1
          WHEN 'two' THEN 2
          ELSE 3
        END
      FROM
        table

    `);
  });

  it('formats CASE ... WHEN with an expression', () => {
    const result = format(
      "CASE toString(getNumber()) WHEN 'one' THEN 1 WHEN 'two' THEN 2 WHEN 'three' THEN 3 ELSE 4 END;"
    );

    expect(result).toBe(dedent`
      CASE
        toString(getNumber())
        WHEN 'one' THEN 1
        WHEN 'two' THEN 2
        WHEN 'three' THEN 3
        ELSE 4
      END;

    `);
  });

  it('properly converts to uppercase in case statements', () => {
    const result = format(
      "case toString(getNumber()) when 'one' then 1 when 'two' then 2 when 'three' then 3 else 4 end;",
      { uppercase: true }
    );
    expect(result).toBe(dedent`
      CASE
        toString(getNumber())
        WHEN 'one' THEN 1
        WHEN 'two' THEN 2
        WHEN 'three' THEN 3
        ELSE 4
      END;

    `);
  });

  it('formats Oracle recursive sub queries', () => {
    const result = format(`
      WITH t1(id, parent_id) AS (
        -- Anchor member.
        SELECT
          id,
          parent_id
        FROM
          tab1
        WHERE
          parent_id IS NULL
        MINUS
          -- Recursive member.
        SELECT
          t2.id,
          t2.parent_id
        FROM
          tab1 t2,
          t1
        WHERE
          t2.parent_id = t1.id
      ) SEARCH BREADTH FIRST BY id SET order1,
      another AS (SELECT * FROM dual)
      SELECT id, parent_id FROM t1 ORDER BY order1;
    `);
    expect(result).toBe(dedent`
      WITH t1(id, parent_id) AS (
        -- Anchor member.
        SELECT
          id,
          parent_id
        FROM
          tab1
        WHERE
          parent_id IS NULL
        MINUS
        -- Recursive member.
        SELECT
          t2.id,
          t2.parent_id
        FROM
          tab1 t2,
          t1
        WHERE
          t2.parent_id = t1.id
      ) SEARCH BREADTH FIRST BY id SET order1,
      another AS (
        SELECT
          *
        FROM
          dual
      )
      SELECT
        id,
        parent_id
      FROM
        t1
      ORDER BY
        order1;

    `);
  });

  it('formats Oracle recursive sub queries regardless of capitalization', () => {
    const result = format(/* sql */ `
      WITH t1(id, parent_id) AS (
        -- Anchor member.
        SELECT
          id,
          parent_id
        FROM
          tab1
        WHERE
          parent_id IS NULL
        MINUS
          -- Recursive member.
        SELECT
          t2.id,
          t2.parent_id
        FROM
          tab1 t2,
          t1
        WHERE
          t2.parent_id = t1.id
      ) SEARCH BREADTH FIRST by id set order1,
      another AS (SELECT * FROM dual)
      SELECT id, parent_id FROM t1 ORDER BY order1;
    `);
    expect(result).toBe(dedent`
      WITH t1(id, parent_id) AS (
        -- Anchor member.
        SELECT
          id,
          parent_id
        FROM
          tab1
        WHERE
          parent_id IS NULL
        MINUS
        -- Recursive member.
        SELECT
          t2.id,
          t2.parent_id
        FROM
          tab1 t2,
          t1
        WHERE
          t2.parent_id = t1.id
      ) SEARCH BREADTH FIRST by id set order1,
      another AS (
        SELECT
          *
        FROM
          dual
      )
      SELECT
        id,
        parent_id
      FROM
        t1
      ORDER BY
        order1;

    `);
  });
});
