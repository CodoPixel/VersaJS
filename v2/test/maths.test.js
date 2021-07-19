import assert from 'assert';
import { NoneValue } from '../values.js';
import { Interpreter } from '../interpreter.js';
import { Token, TokenType } from '../tokens.js'; // ok
import { Context } from '../context.js'; // ok
import global_symbol_table from '../symbol_table.js'; // ok
import { RuntimeError } from '../Exceptions.js';
import { AddNode, ClassCallNode, ClassDefNode, DictionnaryElementNode, DictionnaryNode, DivideNode, EnumNode, EqualsNode, GreaterThanNode, GreaterThanOrEqualNode, LessThanNode, LessThanOrEqualNode, ListNode, ModuloNode, MultiplyNode, NoneNode, NotEqualsNode, NotNode, NumberNode, PowerNode, StringNode, VarAccessNode, VarAssignNode } from '../nodes.js';

const context = new Context('<program>'); // the context will get modified by visiting the different user's actions.
context.symbol_table = global_symbol_table;

/* 
How to make tests with the interpreter?

* Because of a glitch, we have to comment `CONSTANTS` in symbol_table.js AND replace it with an empty object
* Design an operation (example: 5 ^ (1 + 2 * 10 / 10))
* Test this operation and don't forget to console.log the generated tree (in run.js) (it might help)
* Recreate that tree in your test.

Tests with `mocha` (npm run test ./test/interpreter.test.js)

! Careful, the context is the same throughout every tests, therefore we might get errors such as "variable 'i' already exists"

*/

// HELPERS
const number = (n) => {
    return new NumberNode(new Token(TokenType.NUMBER, n));
};

const str = (string, allow_concatenation=true) => {
    return new StringNode(new Token(TokenType.STRING, string), allow_concatenation);
};

const identifier_tok = (string) => {
    return new Token(TokenType.IDENTIFIER, string, null, null);
};

const none = () => {
    return new NoneNode(null, null);
};

describe('Maths (tests every possible combinations for every kind of arithmetic operation)', () => {
    it('should work with an adddition', () => {
        const interpreter = new Interpreter();
        let tree;
        let expected;
        let result;

        // ---
        // Every possible addition that returns a number
        // ---
        // 2 + 2         == 4      OK
        // 2 + none      == 2      OK
        // none + 2      == 2      OK
        tree = new AddNode(
            number(2),
            number(2),
        );
        expected = 4;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new AddNode(
            number(2),
            none(),
        );
        expected = 2;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new AddNode(
            none(),
            number(2),
        );
        expected = 2;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);

        // ---
        // Every possible addition that returns a string
        // ---
        // 2 + "string"           == "2string"       OK
        // "string" + 2           == "string2"       OK
        // "string" + "string"    == "stringstring"  OK
        // "string" + none        == "string"        OK
        // none + "string"        == "string"        OK
        tree = new AddNode(
            number(2),
            str("string"),
        );
        expected = "2string";
        assert.deepStrictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new AddNode(
            str("string"),
            number(2),
        );
        expected = "string2";
        assert.deepStrictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new AddNode(
            str("string"),
            str("string"),
        );
        expected = "stringstring";
        assert.deepStrictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new AddNode(
            str("string"),
            none(),
        );
        expected = "string";
        assert.deepStrictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new AddNode(
            none(),
            str("string"),
        );
        expected = "string";
        assert.deepStrictEqual(interpreter.visit(tree, context).value.value, expected);
        // ---

        // ---
        // Every possible addition that returns a list
        // ---
        // [0] + 1                == [0, 1]              OK
        // 1 + [0]                == [0, 1]              OK
        // [0] + "string"         == [0, "string"]       OK
        // "string" + [0]         == [0, "string"]       OK
        // [0] + [1]              == [0, 1]              OK
        // [0] + {"age":17}       == [0, {"age":17}]     OK
        // {"age":17} + [0]       == [0, {"age":17}]     OK
        // [0] + Class            == [0, Class]          OK
        // Class + [0]            == [0, Class]          OK
        // [0] + Enum             == [0, Enum]           OK
        // Enum + [0]             == [0, Enum]           OK
        // [0] + none             == [0, none]           OK
        // none + [0]             == [0, none]           OK
        tree = new AddNode(
            new ListNode([number(0)], null, null),
            number(1),
        );
        expected = [0, 1];
        assert.deepStrictEqual(interpreter.visit(tree, context).value.elements.map(v=>v.value), expected);
        tree = new AddNode(
            number(1),
            new ListNode([number(0)], null, null),
        );
        expected = [0, 1];
        assert.deepStrictEqual(interpreter.visit(tree, context).value.elements.map(v=>v.value), expected);
        tree = new AddNode(
            new ListNode([number(0)], null, null),
            str("string"),
        );
        expected = [0, "string"];
        assert.deepStrictEqual(interpreter.visit(tree, context).value.elements.map(v=>v.value), expected);
        tree = new AddNode(
            str("string"),
            new ListNode([number(0)], null, null),
        );
        expected = [0, "string"];
        assert.deepStrictEqual(interpreter.visit(tree, context).value.elements.map(v=>v.value), expected);
        tree = new AddNode(
            new ListNode([number(0)], null, null),
            new ListNode([number(1)], null, null),
        );
        expected = [0, 1];
        assert.deepStrictEqual(interpreter.visit(tree, context).value.elements.map(v=>v.value), expected);
        tree = new AddNode(
            new ListNode([number(0)], null, null),
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(
                        str("age"),
                        number(17)
                    ),
                ],
                null,
                null
            ),
        );
        result = interpreter.visit(tree, context);
        assert.deepStrictEqual(result.value.elements[0].value, 0);
        assert.deepStrictEqual(result.value.elements[1].elements.get('age').value, 17);
        tree = new AddNode(
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(
                        str("age"),
                        number(17)
                    ),
                ],
                null,
                null
            ),
            new ListNode([number(0)], null, null),
        );
        result = interpreter.visit(tree, context);
        assert.deepStrictEqual(result.value.elements[0].value, 0);
        assert.deepStrictEqual(result.value.elements[1].elements.get('age').value, 17);
        tree = new ListNode(
            [
                new ClassDefNode(
                    identifier_tok("add_list_and_class"),
                    null,
                    [],
                    [],
                    [],
                    [],
                    null,
                    null
                ),
                new VarAssignNode(
                    identifier_tok("test_add_list_and_class"),
                    new ClassCallNode(identifier_tok("add_list_and_class"), [])
                ),
                new AddNode(
                    new ListNode(
                        [number(0)],
                        null,
                        null
                    ),
                    new VarAccessNode(identifier_tok("test_add_list_and_class")),
                ),
            ],
            null,
            null
        ),
        result = interpreter.visit(tree, context);
        assert.deepStrictEqual(result.value.elements[2].elements[0].value, 0);
        assert.deepStrictEqual(result.value.elements[2].elements[1].name, "add_list_and_class");
        tree = new ListNode(
            [
                new ClassDefNode(
                    identifier_tok("add_list_and_class2"),
                    null,
                    [],
                    [],
                    [],
                    [],
                    null,
                    null
                ),
                new VarAssignNode(
                    identifier_tok("test_add_list_and_class2"),
                    new ClassCallNode(identifier_tok("add_list_and_class2"), [])
                ),
                new AddNode(
                    new VarAccessNode(identifier_tok("test_add_list_and_class2")),
                    new ListNode(
                        [number(0)],
                        null,
                        null
                    ),
                ),
            ],
            null,
            null
        ),
        result = interpreter.visit(tree, context);
        assert.deepStrictEqual(result.value.elements[2].elements[0].value, 0);
        assert.deepStrictEqual(result.value.elements[2].elements[1].name, "add_list_and_class2");
        tree = new ListNode(
            [
                new EnumNode(
                    identifier_tok("list_enum"),
                    [identifier_tok("test")]
                ),
                new AddNode(
                    new ListNode(
                        [number(0)],
                        null,
                        null
                    ),
                    new VarAccessNode(identifier_tok("list_enum")),
                ),
            ],
            null,
            null
        ),
        result = interpreter.visit(tree, context);
        assert.deepStrictEqual(result.value.elements[1].elements[0].value, 0);
        assert.deepStrictEqual(result.value.elements[1].elements[1].name, "list_enum");
        tree = new ListNode(
            [
                new EnumNode(
                    identifier_tok("list_enum2"),
                    [identifier_tok("test")]
                ),
                new AddNode(
                    new VarAccessNode(identifier_tok("list_enum2")),
                    new ListNode(
                        [number(0)],
                        null,
                        null
                    ),
                ),
            ],
            null,
            null
        ),
        result = interpreter.visit(tree, context);
        assert.deepStrictEqual(result.value.elements[1].elements[0].value, 0);
        assert.deepStrictEqual(result.value.elements[1].elements[1].name, "list_enum2");
        tree = new AddNode(
            new ListNode([number(0)], null, null),
            none(),
        );
        result = interpreter.visit(tree, context)
        assert.deepStrictEqual(result.value.elements[0].value, 0);
        assert.deepStrictEqual(result.value.elements[1] instanceof NoneValue, true);
        tree = new AddNode(
            none(),
            new ListNode([number(0)], null, null),
        );
        result = interpreter.visit(tree, context)
        assert.deepStrictEqual(result.value.elements[0].value, 0);
        assert.deepStrictEqual(result.value.elements[1] instanceof NoneValue, true);
        // ---

        // ---
        // Every possible addition that returns a dictionnary
        // ---
        // {"age":17} + {"name":"thomas"}    == {"age":17,"name":"thomas"}  OK
        tree = new AddNode(
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(
                        str("age"),
                        number(17)
                    )
                ],
                null,
                null
            ),
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(
                        str("name"),
                        number("thomas")
                    )
                ],
                null,
                null
            ),
        );
        result = interpreter.visit(tree, context);
        assert.deepStrictEqual(result.value.elements.get('age').value, 17);
        assert.deepStrictEqual(result.value.elements.get('name').value, "thomas");
        // ---

        // ---
        // Special
        // ---
        // none + none    == 0  OK
        tree = new AddNode(
            none(),
            none(),
        );
        expected = 0;
        assert.deepStrictEqual(interpreter.visit(tree, context).value.value, expected);
    });

    it('should work with a multiplication', () => {
        const interpreter = new Interpreter();
        let tree;
        let expected;
        let result;

        // ---
        // Every possible division that returns a number
        // ---
        // 10 * 2        == 20     OK
        // 10 * none     == 0      OK
        // none * 10     == 0      OK
        // none * none   == 0      OK
        tree = new MultiplyNode(
            number(10),
            number(2),
        );
        expected = 20;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new MultiplyNode(
            number(10),
            none(),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new MultiplyNode(
            none(),
            number(10),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new MultiplyNode(
            none(),
            none(),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);

        // ---
        // Every possible division that returns a string
        // ---
        // "str" * 2     == "strstr"     OK
        // 2 * "str"     == "strstr"     OK
        tree = new MultiplyNode(
            str("str"),
            number(2),
        );
        expected = "strstr";
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new MultiplyNode(
            number(2),
            str("str"),
        );
        expected = "strstr";
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);

        // ---
        // Every possible division that returns a list
        // ---
        // [0] * 3       == [0, 0, 0]     OK
        // 3 * [0]       == [0, 0, 0]     OK
        tree = new MultiplyNode(
            new ListNode([number(0)],null,null),
            number(3),
        );
        expected = [0, 0, 0];
        assert.deepStrictEqual(interpreter.visit(tree, context).value.elements.map(v=>v.value), expected);
        tree = new MultiplyNode(
            number(3),
            new ListNode([number(0)],null,null),
        );
        expected = [0, 0, 0];
        assert.deepStrictEqual(interpreter.visit(tree, context).value.elements.map(v=>v.value), expected);
    });

    it('should work with a division', () => {
        const interpreter = new Interpreter();
        let tree;
        let expected;
        let result;

        // ---
        // Every possible division that returns a number
        // ---
        // 10 / 2        == 5      OK
        // 5 / none      == error  OK
        // none / 5      == error  OK
        // none / none   == error  OK
        tree = new DivideNode(
            number(10),
            number(2),
        );
        expected = 5;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        try {
            tree = new DivideNode(
                number(5),
                none(),
            );
            assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        } catch(e) {
            assert.strictEqual(true, e instanceof RuntimeError);
        }
        try {
            tree = new DivideNode(
                none(),
                number(5),
            );
            assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        } catch(e) {
            assert.strictEqual(true, e instanceof RuntimeError);
        }
        try {
            tree = new DivideNode(
                none(),
                none(),
            );
            assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        } catch(e) {
            assert.strictEqual(true, e instanceof RuntimeError);
        }
    });

    it('should work with a modulo', () => {
        const interpreter = new Interpreter();
        let tree;
        let expected;
        let result;

        // ---
        // Every possible modulo that returns a number
        // ---
        // 10 % 2        == 0      OK
        // 5 % none      == error  OK
        // none % 5      == error  OK
        // none % none   == error  OK
        tree = new ModuloNode(
            number(10),
            number(2),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        try {
            tree = new ModuloNode(
                number(5),
                none(),
            );
            assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        } catch(e) {
            assert.strictEqual(true, e instanceof RuntimeError);
        }
        try {
            tree = new ModuloNode(
                none(),
                number(5),
            );
            assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        } catch(e) {
            assert.strictEqual(true, e instanceof RuntimeError);
        }
        try {
            tree = new ModuloNode(
                none(),
                none(),
            );
            assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        } catch(e) {
            assert.strictEqual(true, e instanceof RuntimeError);
        }
    });

    it('should work with a power operation', () => {
        const interpreter = new Interpreter();
        let tree;
        let expected;
        let result;

        // ---
        // Every possible power operations that returns a number
        // ---
        // 10 ^ 2                 == 100      OK
        // 10 ^ none              == 1        OK
        // none ^ 10              == 1        OK
        // none ^ none            == 1        OK
        tree = new PowerNode(
            number(10),
            number(2),
        );
        expected = 100;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new PowerNode(
            number(10),
            none(),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new PowerNode(
            none(),
            number(10),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new PowerNode(
            none(),
            none(),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);

        // ---
        // Every possible power operations that returns a list
        // ---
        // [5, 10] ^ 2            == [25, 100]      OK
        // 2 ^ [5, 10]            == [25, 100]      OK
        tree = new PowerNode(
            new ListNode([number(5),number(10)],null,null),
            number(2),
        );
        expected = [25, 100];
        assert.deepStrictEqual(interpreter.visit(tree, context).value.elements.map(v=>v.value), expected);
        tree = new PowerNode(
            number(2),
            new ListNode([number(5),number(10)],null,null),
        );
        expected = [25, 100];
        assert.deepStrictEqual(interpreter.visit(tree, context).value.elements.map(v=>v.value), expected);
    });

    it('should work with a not node', () => {
        const interpreter = new Interpreter();
        let tree;
        let expected;
        let result;

        // ---
        // Every possible combinations for a not node
        // ---
        // not 0             == 1      OK
        // not none          == 1      OK
        // not "something"   == 0      OK
        tree = new NotNode(
            number(0),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new NotNode(
            none(),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new NotNode(
            str("something"),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
    });

    it('should work with an equals node', () => {
        const interpreter = new Interpreter();
        let tree;
        let expected;
        let result;

        // ---
        // Every possible combination that returns a number
        // ---
        // 0 == 0                       == 1      OK
        // [5, 6] == [5, 6]             == 1      OK
        // "5" == 5                     == 1      OK
        // 5 == "5"                     == 1      OK
        // {"age":17} == {"age":17}     == 1      OK
        // none == none                 == 1      OK
        // none == 0                    == 1      OK
        // 0 == none                    == 1      OK
        // "str" == none                == 0      OK
        tree = new EqualsNode(
            number(0),
            number(0),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new EqualsNode(
            new ListNode([number(5),number(6)],null,null),
            new ListNode([number(5),number(6)],null,null),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new EqualsNode(
            str("5"),
            number(5),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new EqualsNode(
            number(5),
            str("5"),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new EqualsNode(
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("age"),number(17))
                ],
                null,
                null
            ),
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("age"),number(17))
                ],
                null,
                null
            ),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new EqualsNode(
            none(),
            none(),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new EqualsNode(
            none(),
            number(0),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new EqualsNode(
            number(0),
            none(),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new EqualsNode(
            str("str"),
            none(),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
    });

    it('should work with a less than node', () => {
        const interpreter = new Interpreter();
        let tree;
        let expected;
        let result;

        // ---
        // Every possible combinations for a less than node
        // ---
        // 5 < 6                        == 1      OK
        // 5 < 5                        == 0      OK
        // [5, 6] < 3                   == 1      OK
        // [5, 6] < 1                   == 0      OK
        // 1 < [5, 6]                   == 1      OK
        // 3 < [5, 6]                   == 0      OK
        // [5] < [5, 6]                 == 1      OK
        // [5, 6, 7] < [5, 6]           == 0      OK
        // "str" < 5                    == 1      OK
        // "str" < 1                    == 0      OK
        // 1 < "str"                    == 1      OK
        // 5 < "str"                    == 0      OK
        // {} < {"a":1}                 == 1      OK
        // {"a":1} < {}                 == 0      OK
        // {"a":1} < 0                  == 0      OK
        // 0 < {"a":1}                  == 1      OK
        // none < none                  == 0      OK
        // none < 5                     == 1      OK
        // none < 0                     == 0      OK
        // -1 < none                    == 1      OK
        // 5 < none                     == 0      OK
        tree = new LessThanNode(
            number(5),
            number(6),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            number(5),
            number(5),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            new ListNode([number(5),number(6)],null,null),
            number(3),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            new ListNode([number(5),number(6)],null,null),
            number(1),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            number(1),
            new ListNode([number(5),number(6)],null,null),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            number(3),
            new ListNode([number(5),number(6)],null,null),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            new ListNode([number(5)],null,null),
            new ListNode([number(5),number(6)],null,null),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            new ListNode([number(5),number(6),number(7)],null,null),
            new ListNode([number(5),number(6)],null,null),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            str("str"),
            number(5),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            str("str"),
            number(1),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            number(1),
            str("str"),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            number(5),
            str("str"),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            new DictionnaryNode(
                [],
                null,
                null,
            ),
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("a"),number(1)),
                ],
                null,
                null,
            ),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("a"),number(1)),
                ],
                null,
                null,
            ),
            new DictionnaryNode(
                [],
                null,
                null,
            ),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("a"),number(1)),
                ],
                null,
                null,
            ),
            number(0),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            number(0),
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("a"),number(1)),
                ],
                null,
                null,
            ),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            none(),
            none(),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            none(),
            number(5),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            none(),
            number(0),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            number(-1),
            none(),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanNode(
            number(5),
            none(),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
    });

    it('should work with a greater than node', () => {
        const interpreter = new Interpreter();
        let tree;
        let expected;
        let result;

        // ---
        // Every possible combinations for a greater than node
        // ---
        // 6 > 4                        == 1      OK
        // 5 > 5                        == 0      OK
        // 3 > [5, 6]                   == 1      OK
        // 1 > [5, 6]                   == 0      OK
        // [5, 6] > 1                   == 1      OK
        // [5, 6] > 3                   == 0      OK
        // [5, 6] > [5]                 == 1      OK
        // [5, 6] > [5, 6, 7]           == 0      OK
        // 5 > "str"                    == 1      OK
        // 1 > "str"                    == 0      OK
        // "str" > 1                    == 1      OK
        // "str" > 5                    == 0      OK
        // {"a":1} > {}                 == 1      OK
        // {} > {"a":1}                 == 0      OK
        // 0 > {"a":1}                  == 0      OK
        // {"a":1} > 0                  == 1      OK
        // none > none                  == 0      OK
        // 5 > none                     == 1      OK
        // 0 > none                     == 0      OK
        // none > -1                    == 1      OK
        // none > 5                     == 0      OK
        tree = new GreaterThanNode(
            number(6),
            number(5),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            number(5),
            number(5),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            number(3),
            new ListNode([number(5),number(6)],null,null),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            number(1),
            new ListNode([number(5),number(6)],null,null),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            new ListNode([number(5),number(6)],null,null),
            number(1),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            new ListNode([number(5),number(6)],null,null),
            number(3),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            new ListNode([number(5),number(6)],null,null),
            new ListNode([number(5)],null,null),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            new ListNode([number(5),number(6)],null,null),
            new ListNode([number(5),number(6),number(7)],null,null),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            number(5),
            str("str"),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            number(1),
            str("str"),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            str("str"),
            number(1),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            str("str"),
            number(5),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("a"),number(1)),
                ],
                null,
                null,
            ),
            new DictionnaryNode(
                [],
                null,
                null,
            ),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            new DictionnaryNode(
                [],
                null,
                null,
            ),
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("a"),number(1)),
                ],
                null,
                null,
            ),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            number(0),
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("a"),number(1)),
                ],
                null,
                null,
            ),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("a"),number(1)),
                ],
                null,
                null,
            ),
            number(0),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            none(),
            none(),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            number(5),
            none(),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            number(0),
            none(),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            none(),
            number(-1),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanNode(
            none(),
            number(5),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
    });

    it('should work with a less than or equal node', () => {
        const interpreter = new Interpreter();
        let tree;
        let expected;
        let result;

        // ---
        // Every possible combinations for a less than or equal node
        // ---
        // 5 <= 6                        == 1      OK
        // 5 <= 5                        == 1      OK
        // [5, 6] <= 3                   == 1      OK
        // [5, 6] <= 1                   == 0      OK
        // 1 <= [5, 6]                   == 1      OK
        // 3 <= [5, 6]                   == 0      OK
        // [5] <= [5, 6]                 == 1      OK
        // [5, 6, 7] <= [5, 6]           == 0      OK
        // "str" <= 5                    == 1      OK
        // "str" <= 1                    == 0      OK
        // 1 <= "str"                    == 1      OK
        // 5 <= "str"                    == 0      OK
        // {} <= {"a":1}                 == 1      OK
        // {"a":1} <= {}                 == 0      OK
        // {"a":1} <= 0                  == 0      OK
        // 0 <= {"a":1}                  == 1      OK
        // none <= none                  == 1      OK
        // none <= 5                     == 1      OK
        // none <= 0                     == 1      OK
        // -1 <= none                    == 1      OK
        // 5 <= none                     == 0      OK
        tree = new LessThanOrEqualNode(
            number(5),
            number(6),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            number(5),
            number(5),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            new ListNode([number(5),number(6)],null,null),
            number(3),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            new ListNode([number(5),number(6)],null,null),
            number(1),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            number(1),
            new ListNode([number(5),number(6)],null,null),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            number(3),
            new ListNode([number(5),number(6)],null,null),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            new ListNode([number(5)],null,null),
            new ListNode([number(5),number(6)],null,null),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            new ListNode([number(5),number(6),number(7)],null,null),
            new ListNode([number(5),number(6)],null,null),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            str("str"),
            number(5),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            str("str"),
            number(1),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            number(1),
            str("str"),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            number(5),
            str("str"),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            new DictionnaryNode(
                [],
                null,
                null,
            ),
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("a"),number(1)),
                ],
                null,
                null,
            ),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("a"),number(1)),
                ],
                null,
                null,
            ),
            new DictionnaryNode(
                [],
                null,
                null,
            ),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("a"),number(1)),
                ],
                null,
                null,
            ),
            number(0),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            number(0),
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("a"),number(1)),
                ],
                null,
                null,
            ),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            none(),
            none(),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            none(),
            number(5),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            none(),
            number(0),
        );
        expected = 1
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            number(-1),
            none(),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new LessThanOrEqualNode(
            number(5),
            none(),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
    });

    it('should work with a greater than or equal node', () => {
        const interpreter = new Interpreter();
        let tree;
        let expected;
        let result;

        // ---
        // Every possible combinations for a greater than or equal node
        // ---
        // 6 >= 4                        == 1      OK
        // 5 >= 5                        == 1      OK
        // 3 >= [5, 6]                   == 1      OK
        // 1 >= [5, 6]                   == 0      OK
        // [5, 6] >= 1                   == 1      OK
        // [5, 6] >= 3                   == 0      OK
        // [5, 6] >= [5]                 == 1      OK
        // [5, 6] >= [5, 6, 7]           == 0      OK
        // 5 >= "str"                    == 1      OK
        // 1 >= "str"                    == 0      OK
        // "str" >= 1                    == 1      OK
        // "str" >= 5                    == 0      OK
        // {"a":1} >= {}                 == 1      OK
        // {} >= {"a":1}                 == 0      OK
        // 0 >= {"a":1}                  == 0      OK
        // {"a":1} >= 0                  == 1      OK
        // none >= none                  == 1      OK
        // 5 >= none                     == 1      OK
        // 0 >= none                     == 1      OK
        // none >= -1                    == 1      OK
        // none >= 5                     == 0      OK
        tree = new GreaterThanOrEqualNode(
            number(6),
            number(5),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            number(5),
            number(5),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            number(3),
            new ListNode([number(5),number(6)],null,null),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            number(1),
            new ListNode([number(5),number(6)],null,null),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            new ListNode([number(5),number(6)],null,null),
            number(1),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            new ListNode([number(5),number(6)],null,null),
            number(3),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            new ListNode([number(5),number(6)],null,null),
            new ListNode([number(5)],null,null),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            new ListNode([number(5),number(6)],null,null),
            new ListNode([number(5),number(6),number(7)],null,null),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            number(5),
            str("str"),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            number(1),
            str("str"),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            str("str"),
            number(1),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            str("str"),
            number(5),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("a"),number(1)),
                ],
                null,
                null,
            ),
            new DictionnaryNode(
                [],
                null,
                null,
            ),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            new DictionnaryNode(
                [],
                null,
                null,
            ),
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("a"),number(1)),
                ],
                null,
                null,
            ),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            number(0),
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("a"),number(1)),
                ],
                null,
                null,
            ),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("a"),number(1)),
                ],
                null,
                null,
            ),
            number(0),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            none(),
            none(),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            number(5),
            none(),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            number(0),
            none(),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            none(),
            number(-1),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new GreaterThanOrEqualNode(
            none(),
            number(5),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
    });

    it('should work with a not equals node', () => {
        const interpreter = new Interpreter();
        let tree;
        let expected;
        let result;

        // ---
        // Every possible combination that returns a number
        // ---
        // 0 != 0                       == 0      OK
        // [5, 6] != [5, 6]             == 0      OK
        // "5" != 5                     == 0      OK
        // 5 != "5"                     == 0      OK
        // {"age":17} != {"age":17}     == 0      OK
        // none != none                 == 0      OK
        // none != 0                    == 0      OK
        // 0 != none                    == 0      OK
        // "str" != none                == 1      OK
        tree = new NotEqualsNode(
            number(0),
            number(0),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new NotEqualsNode(
            new ListNode([number(5),number(6)],null,null),
            new ListNode([number(5),number(6)],null,null),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new NotEqualsNode(
            str("5"),
            number(5),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new NotEqualsNode(
            number(5),
            str("5"),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new NotEqualsNode(
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("age"),number(17))
                ],
                null,
                null
            ),
            new DictionnaryNode(
                [
                    new DictionnaryElementNode(str("age"),number(17))
                ],
                null,
                null
            ),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new NotEqualsNode(
            none(),
            none(),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new NotEqualsNode(
            none(),
            number(0),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new NotEqualsNode(
            number(0),
            none(),
        );
        expected = 0;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
        tree = new NotEqualsNode(
            str("str"),
            none(),
        );
        expected = 1;
        assert.strictEqual(interpreter.visit(tree, context).value.value, expected);
    });
});