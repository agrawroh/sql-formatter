import dedent from 'dedent-js';
import * as sqlFormatter from './../src/sqlFormatter';

/**
 * Core tests for all SQL formatters
 * @param {String} language
 */
export default function behavesLikeSqlFormatter(language) {
  const format = (query, cfg = {}) => sqlFormatter.format(query, { ...cfg, language });

  it('uses given indent config for indention', () => {
    const result = format('SELECT count(*),Column1 FROM Table1;', {
      indent: '    ',
    });

    expect(result).toBe(dedent`
      SELECT
          count(*),
          Column1
      FROM
          Table1;

    `);
  });

  it('formats simple SET SCHEMA queries', () => {
    const result = format('SET SCHEMA schema1; SET CURRENT SCHEMA schema2;');
    expect(result).toBe(dedent`
      SET SCHEMA
        schema1;
      SET CURRENT SCHEMA
        schema2;

    `);
  });

  it('formats simple SELECT query', function () {
    const result = format('SELECT count(*),Column1 FROM Table1;');
    expect(result).toBe(dedent`
      SELECT
        count(*),
        Column1
      FROM
        Table1;

    `);
  });

  it('formats complex SELECT', function () {
    const result = format(
      "SELECT DISTINCT name, ROUND(age/7) field1, 18 + 20 AS field2, 'some string' FROM foo;"
    );
    expect(result).toBe(dedent`
      SELECT
        DISTINCT name,
        ROUND(age / 7) field1,
        18 + 20 AS field2,
        'some string'
      FROM
        foo;

    `);
  });

  it('formats SELECT with complex WHERE', () => {
    const result = sqlFormatter.format(`
      SELECT * FROM foo WHERE Column1 = 'testing'
      AND ( (Column2 = Column3 OR Column4 >= NOW()) );
    `);
    expect(result).toBe(dedent`
      SELECT
        *
      FROM
        foo
      WHERE
        Column1 = 'testing'
        AND (
          (
            Column2 = Column3
            OR Column4 >= NOW()
          )
        );

    `);
  });

  it('formats SELECT with top level reserved words', () => {
    const result = format(`
      SELECT * FROM foo WHERE name = 'John' GROUP BY some_column
      HAVING column > 10 ORDER BY other_column LIMIT 5;
    `);
    expect(result).toBe(dedent`
      SELECT
        *
      FROM
        foo
      WHERE
        name = 'John'
      GROUP BY
        some_column
      HAVING
        column > 10
      ORDER BY
        other_column
      LIMIT
        5;

    `);
  });

  it('formats LIMIT with two comma-separated values on single line', function () {
    const result = format('LIMIT 5, 10;');
    expect(result).toBe(dedent`
      LIMIT
        5, 10;

    `);
  });

  it('formats LIMIT of single value followed by another SELECT using commas', function () {
    const result = format('LIMIT 5; SELECT foo, bar;');
    expect(result).toBe(dedent`
      LIMIT
        5;
      SELECT
        foo,
        bar;

    `);
  });

  it('formats LIMIT of single value and OFFSET', function () {
    const result = format('LIMIT 5 OFFSET 8;');
    expect(result).toBe(dedent`
      LIMIT
        5 OFFSET 8;

    `);
  });

  it('recognizes LIMIT in lowercase', function () {
    const result = format('limit 5, 10;');
    expect(result).toBe(dedent`
      limit
        5, 10;

    `);
  });

  it('preserves case of keywords', function () {
    const result = format('select distinct * frOM foo left join bar WHERe a > 1 and b = 3');
    expect(result).toBe(dedent`
      select
        distinct *
      frOM
        foo
        left join bar
      WHERe
        a > 1
        and b = 3

    `);
  });

  it('formats SELECT query with SELECT query inside it', function () {
    const result = format(
      'SELECT *, SUM(*) AS sum FROM (SELECT * FROM Posts LIMIT 30) WHERE a > b'
    );
    expect(result).toBe(dedent`
      SELECT
        *,
        SUM(*) AS sum
      FROM
        (
          SELECT
            *
          FROM
            Posts
          LIMIT
            30
        )
      WHERE
        a > b

    `);
  });

  it('formats SELECT query with INNER JOIN', () => {
    const result = format(`
      SELECT customer_id.from, COUNT(order_id) AS total FROM customers
      INNER JOIN orders ON customers.customer_id = orders.customer_id;
    `);
    expect(result).toBe(dedent`
      SELECT
        customer_id.from,
        COUNT(order_id) AS total
      FROM
        customers
        INNER JOIN orders ON customers.customer_id = orders.customer_id;

    `);
  });

  it('formats SELECT query with different comments', () => {
    const result = format(dedent`
      SELECT
      /*
       * This is a block comment
       */
      * FROM
      -- This is another comment
      MyTable # One final comment
      WHERE 1 = 2;

    `);
    expect(result).toBe(dedent`
      SELECT
        /*
         * This is a block comment
         */
        *
      FROM
        -- This is another comment
        MyTable # One final comment
      WHERE
        1 = 2;

    `);
  });

  it('maintains block comment indentation', () => {
    const sql = dedent`
      SELECT
        /*
         * This is a block comment
         */
        *
      FROM
        MyTable
      WHERE
        1 = 2;

    `;
    expect(format(sql)).toBe(sql);
  });

  it('formats simple INSERT query', () => {
    const result = format(
      "INSERT INTO Customers (ID, MoneyBalance, Address, City) VALUES (12,-123.4, 'Skagen 2111','Stv');"
    );
    expect(result).toBe(dedent`
      INSERT INTO
        Customers (ID, MoneyBalance, Address, City)
      VALUES
        (12, -123.4, 'Skagen 2111', 'Stv');

    `);
  });

  it('formats open paren after comma', () => {
    const result = format(
      'WITH TestIds AS (VALUES (4),(5), (6),(7),(9),(10),(11)) SELECT * FROM TestIds;'
    );
    expect(result).toBe(dedent/* sql */ `
      WITH TestIds AS (
        VALUES
          (4),
          (5),
          (6),
          (7),
          (9),
          (10),
          (11)
      )
      SELECT
        *
      FROM
        TestIds;

    `);
  });

  it('keeps short parenthesized list with nested parenthesis on single line', () => {
    const result = format('SELECT (a + b * (c - NOW()));');
    expect(result).toBe(dedent`
      SELECT
        (a + b * (c - NOW()));

    `);
  });

  it('breaks long parenthesized lists to multiple lines', () => {
    const result = format(`
      INSERT INTO some_table (id_product, id_shop, id_currency, id_country, id_registration) (
      SELECT IF(dq.id_discounter_shopping = 2, dq.value, dq.value / 100),
      IF (dq.id_discounter_shopping = 2, 'amount', 'percentage') FROM foo);
    `);
    expect(result).toBe(dedent`
      INSERT INTO
        some_table (
          id_product,
          id_shop,
          id_currency,
          id_country,
          id_registration
        ) (
          SELECT
            IF(
              dq.id_discounter_shopping = 2,
              dq.value,
              dq.value / 100
            ),
            IF (
              dq.id_discounter_shopping = 2,
              'amount',
              'percentage'
            )
          FROM
            foo
        );

    `);
  });

  it('formats simple UPDATE query', function () {
    const result = format(
      "UPDATE Customers SET ContactName='Alfred Schmidt', City='Hamburg' WHERE CustomerName='Alfreds Futterkiste';"
    );
    expect(result).toBe(dedent`
      UPDATE
        Customers
      SET
        ContactName = 'Alfred Schmidt',
        City = 'Hamburg'
      WHERE
        CustomerName = 'Alfreds Futterkiste';

    `);
  });

  it('formats simple DELETE query', function () {
    const result = format("DELETE FROM Customers WHERE CustomerName='Alfred' AND Phone=5002132;");
    expect(result).toBe(dedent`
      DELETE FROM
        Customers
      WHERE
        CustomerName = 'Alfred'
        AND Phone = 5002132;

    `);
  });

  it('formats simple DROP query', function () {
    const result = format('DROP TABLE IF EXISTS admin_role;');
    expect(result).toBe('DROP TABLE IF EXISTS admin_role;\n');
  });

  it('formats incomplete query', () => {
    const result = format('SELECT count(');
    expect(result).toBe(dedent`
      SELECT
        count(

    `);
  });

  it('formats query that ends with open comment', () => {
    const result = format(`
      SELECT count(*)
      /*Comment

    `);
    expect(result).toBe(dedent`
      SELECT
        count(*)
        /*Comment

    `);
  });

  it('formats UPDATE query with AS part', function () {
    const result = format(
      'UPDATE customers SET total_orders = order_summary.total  FROM ( SELECT * FROM bank) AS order_summary'
    );
    expect(result).toBe(dedent`
      UPDATE
        customers
      SET
        total_orders = order_summary.total
      FROM
        (
          SELECT
            *
          FROM
            bank
        ) AS order_summary

    `);
  });

  it('formats top-level and newline multi-word reserved words with inconsistent spacing', function () {
    const result = format('SELECT * FROM foo LEFT \t OUTER  \n JOIN bar ORDER \n BY blah');
    expect(result).toBe(dedent`
      SELECT
        *
      FROM
        foo
        LEFT OUTER JOIN bar
      ORDER BY
        blah

    `);
  });

  it('formats long double parenthized queries to multiple lines', function () {
    const result = format("((foo = '0123456789-0123456789-0123456789-0123456789'))");
    expect(result).toBe(dedent`
      (
        (
          foo = '0123456789-0123456789-0123456789-0123456789'
        )
      )

    `);
  });

  it('formats short double parenthized queries to one line', function () {
    const result = format("((foo = 'bar'))");
    expect(result).toBe("((foo = 'bar'))\n");
  });

  it('formats single-char operators', function () {
    expect(format('foo = bar')).toBe('foo = bar\n');
    expect(format('foo < bar')).toBe('foo < bar\n');
    expect(format('foo > bar')).toBe('foo > bar\n');
    expect(format('foo + bar')).toBe('foo + bar\n');
    expect(format('foo - bar')).toBe('foo - bar\n');
    expect(format('foo * bar')).toBe('foo * bar\n');
    expect(format('foo / bar')).toBe('foo / bar\n');
    expect(format('foo % bar')).toBe('foo % bar\n');
  });

  it('formats multi-char operators', function () {
    expect(format('foo != bar')).toBe('foo != bar\n');
    expect(format('foo <> bar')).toBe('foo <> bar\n');
    expect(format('foo == bar')).toBe('foo == bar\n'); // N1QL
    expect(format('foo || bar')).toBe('foo || bar\n'); // Oracle, Postgre, N1QL string concat

    expect(format('foo <= bar')).toBe('foo <= bar\n');
    expect(format('foo >= bar')).toBe('foo >= bar\n');

    expect(format('foo !< bar')).toBe('foo !< bar\n');
    expect(format('foo !> bar')).toBe('foo !> bar\n');
  });

  it('formats logical operators', function () {
    expect(format('foo ALL bar')).toBe('foo ALL bar\n');
    expect(format('foo = ANY (1, 2, 3)')).toBe('foo = ANY (1, 2, 3)\n');
    expect(format('EXISTS bar')).toBe('EXISTS bar\n');
    expect(format('foo IN (1, 2, 3)')).toBe('foo IN (1, 2, 3)\n');
    expect(format("foo LIKE 'hello%'")).toBe("foo LIKE 'hello%'\n");
    expect(format('foo IS NULL')).toBe('foo IS NULL\n');
    expect(format('UNIQUE foo')).toBe('UNIQUE foo\n');
  });

  it('formats AND/OR operators', function () {
    expect(format('foo BETWEEN bar AND baz')).toBe('foo BETWEEN bar\nAND baz\n');
    expect(format('foo AND bar')).toBe('foo\nAND bar\n');
    expect(format('foo OR bar')).toBe('foo\nOR bar\n');
  });

  it('recognizes strings', function () {
    expect(format('"foo JOIN bar"')).toBe('"foo JOIN bar"\n');
    expect(format("'foo JOIN bar'")).toBe("'foo JOIN bar'\n");
    expect(format('`foo JOIN bar`')).toBe('`foo JOIN bar`\n');
  });

  it('recognizes escaped strings', function () {
    expect(format('"foo \\" JOIN bar"')).toBe('"foo \\" JOIN bar"\n');
    expect(format("'foo \\' JOIN bar'")).toBe("'foo \\' JOIN bar'\n");
    expect(format('`foo `` JOIN bar`')).toBe('`foo `` JOIN bar`\n');
  });

  it('formats postgre specific operators', () => {
    expect(format('column::int')).toBe('column :: int\n');
    expect(format('v->2')).toBe('v -> 2\n');
    expect(format('v->>2')).toBe('v ->> 2\n');
    expect(format("foo ~~ 'hello'")).toBe("foo ~~ 'hello'\n");
    expect(format("foo !~ 'hello'")).toBe("foo !~ 'hello'\n");
    expect(format("foo ~* 'hello'")).toBe("foo ~* 'hello'\n");
    expect(format("foo ~~* 'hello'")).toBe("foo ~~* 'hello'\n");
    expect(format("foo !~~ 'hello'")).toBe("foo !~~ 'hello'\n");
    expect(format("foo !~* 'hello'")).toBe("foo !~* 'hello'\n");
    expect(format("foo !~~* 'hello'")).toBe("foo !~~* 'hello'\n");
    expect(format('@ foo')).toBe('@ foo\n');
    expect(format('foo << 2')).toBe('foo << 2\n');
    expect(format('foo >> 2')).toBe('foo >> 2\n');
    expect(format('|/ foo')).toBe('|/ foo\n');
    expect(format('||/ foo')).toBe('||/ foo\n');
  });

  it('keeps separation between multiple statements', function () {
    expect(format('foo;bar;')).toBe('foo;\nbar;\n');
    expect(format('foo\n;bar;')).toBe('foo;\nbar;\n');
    expect(format('foo\n\n\n;bar;\n\n')).toBe('foo;\nbar;\n');

    const result = format(`
      SELECT count(*),Column1 FROM Table1;
      SELECT count(*),Column1 FROM Table2;
    `);
    expect(result).toBe(dedent`
      SELECT
        count(*),
        Column1
      FROM
        Table1;
      SELECT
        count(*),
        Column1
      FROM
        Table2;

    `);
  });

  it('formats unicode correctly', () => {
    const result = format('SELECT test, тест FROM table;');
    expect(result).toBe(dedent`
      SELECT
        test,
        тест
      FROM
        table;

    `);
  });

  it('`converts keywords to uppercase when option passed in', () => {
    const result = format('select distinct * frOM foo left join bar WHERe cola > 1 and colb = 3', {
      uppercase: true,
    });
    expect(result).toBe(dedent`
      SELECT
        DISTINCT *
      FROM
        foo
        LEFT JOIN bar
      WHERE
        cola > 1
        AND colb = 3

    `);
  });

  it('line breaks between queries change with config', () => {
    const result = format('SELECT * FROM foo; SELECT * FROM bar;', { linesBetweenQueries: 2 });
    expect(result).toBe(dedent`
      SELECT
        *
      FROM
        foo;

      SELECT
        *
      FROM
        bar;

    `);
  });

  it('correctly indents create statement after select', () => {
    const result = sqlFormatter.format(`
      SELECT * FROM test;
      CREATE TABLE TEST(id NUMBER NOT NULL, col1 VARCHAR2(20), col2 VARCHAR2(20));
    `);
    expect(result).toBe(dedent`
      SELECT
        *
      FROM
        test;
      CREATE TABLE TEST(
        id NUMBER NOT NULL,
        col1 VARCHAR2(20),
        col2 VARCHAR2(20)
      );

    `);
  });

  it('correctly handles floats as single tokens', () => {
    const result = sqlFormatter.format('SELECT 1e-9 AS a, 1.5e-10 AS b, 3.5E12 AS c, 3.5e12 AS d;');
    expect(result).toBe(dedent`
      SELECT
        1e-9 AS a,
        1.5e-10 AS b,
        3.5E12 AS c,
        3.5e12 AS d;

    `);
  });

  it('does not split UNION ALL in half', () => {
    const result = sqlFormatter.format(`
      SELECT * FROM tbl1
      UNION ALL
      SELECT * FROM tbl2;

    `);
    expect(result).toBe(dedent/* sql */ `
      SELECT
        *
      FROM
        tbl1
      UNION ALL
      SELECT
        *
      FROM
        tbl2;

    `);
  });
}
