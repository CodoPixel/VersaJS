import assert from 'assert';
import { Lexer } from '../lexer.js';
import { Parser } from '../parser.js';
import { AddNode, DivideNode, ModuloNode, MultiplyNode, NumberNode, PowerNode, SubtractNode } from '../nodes.js';

// npm run test

describe('Parser tests', () => {
    it('should return numbers', () => {
        const tokens = new Lexer("100_000.2").generate_tokens();
        const node = new Parser(tokens).parse();
        assert.deepStrictEqual(true, node instanceof NumberNode);
        // new NumberNode(new Token(TokenType.NUMBER, 100_000.2))
    });

    it('should work with an addition', () => {
        const tokens = new Lexer("27 + 14").generate_tokens();
        const node = new Parser(tokens).parse();
        assert.deepStrictEqual(true, node instanceof AddNode);
        // new AddNode(new NumberNode(new Token(TokenType.NUMBER, 27)), new NumberNode(new Token(TokenType.NUMBER, 14)))
        
    });

    it('should work with a subtraction', () => {
        const tokens = new Lexer("27 - 14").generate_tokens();
        const node = new Parser(tokens).parse();
        assert.deepStrictEqual(true, node instanceof SubtractNode);
        // new SubtractNode(new NumberNode(new Token(TokenType.NUMBER, 27)), new NumberNode(new Token(TokenType.NUMBER, 14)))
    });

    it('should work with a multiplication', () => {
        const tokens = new Lexer("27 * 14").generate_tokens();
        const node = new Parser(tokens).parse();
        assert.deepStrictEqual(true, node instanceof MultiplyNode);
        // new MultiplyNode(new NumberNode(new Token(TokenType.NUMBER, 27)), new NumberNode(new Token(TokenType.NUMBER, 14)))
    });

    it('should work with a division', () => {
        const tokens = new Lexer("27 / 14").generate_tokens();
        const node = new Parser(tokens).parse();
        assert.deepStrictEqual(true, node instanceof DivideNode);
        // new DivideNode(new NumberNode(new Token(TokenType.NUMBER, 27)), new NumberNode(new Token(TokenType.NUMBER, 14)))
    });

    it('should work with a modulo', () => {
        const tokens = new Lexer("27 % 14").generate_tokens();
        const node = new Parser(tokens).parse();
        assert.deepStrictEqual(true, node instanceof ModuloNode);
        // new ModuloNode(new NumberNode(new Token(TokenType.NUMBER, 27)), new NumberNode(new Token(TokenType.NUMBER, 14)))
    });

    it('should work with a power', () => {
        const tokens = new Lexer("27 ^ 14").generate_tokens();
        const node = new Parser(tokens).parse();
        assert.deepStrictEqual(true, node instanceof PowerNode);
        // new PowerNode(new NumberNode(new Token(TokenType.NUMBER, 27)), new NumberNode(new Token(TokenType.NUMBER, 14)))
    });

    it('should work with a complex power', () => {
        const tokens = new Lexer("(1 + 2) ^ (1 + 2)").generate_tokens();
        const node = new Parser(tokens).parse();
        assert.deepStrictEqual(true, node instanceof PowerNode);
        if (node instanceof PowerNode) {
            assert.deepStrictEqual(true, node.node_a instanceof AddNode);
            assert.deepStrictEqual(true, node.node_b instanceof AddNode);
        }
        /* new PowerNode(
            new AddNode(
                new NumberNode(new Token(TokenType.NUMBER, 1)),
                new NumberNode(new Token(TokenType.NUMBER, 2))
            ),
            new AddNode(
                new NumberNode(new Token(TokenType.NUMBER, 1)),
                new NumberNode(new Token(TokenType.NUMBER, 2))
            ),
        )
        */
    });

    it('should work with a full expression', () => {
        const tokens = new Lexer("27 + (43 / 36 - 48) * 51").generate_tokens();
        const node = new Parser(tokens).parse();
        assert.deepStrictEqual(true, node instanceof AddNode);
        /* new AddNode(new NumberNode(new Token(TokenType.NUMBER, 27)),
            new MultiplyNode(
                new SubtractNode(
                    new DivideNode(
                        new NumberNode(new Token(TokenType.NUMBER, 10)),
                        new NumberNode(new Token(TokenType.NUMBER, 2))
                    ),
                    new NumberNode(new Token(TokenType.NUMBER, 48))
                ),
                new NumberNode(new Token(TokenType.NUMBER, 51))
            )
        )
        */
    });
});