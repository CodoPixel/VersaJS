import { TokenType, Token } from "./tokens.js";
import { CustomNode, AddNode, DivideNode, MinusNode, ModuloNode, MultiplyNode, NumberNode, PlusNode, PowerNode, SubtractNode, VarAssignNode, VarAccessNode, VarModifyNode, OrNode, NotNode, AndNode, EqualsNode, LessThanNode, LessThanOrEqualNode, GreaterThanNode, GreaterThanOrEqualNode, NotEqualsNode, ElseAssignmentNode, ListNode, ListAccessNode, ListAssignmentNode, ListPushBracketsNode, ListBinarySelector, StringNode, IfNode, ForNode, WhileNode } from "./nodes.js";
import { is_in } from './miscellaneous.js';
import { InvalidSyntaxError } from "./Exceptions.js";
import { CONSTANTS } from "./symbol_table.js";

/**
 * @classdesc Reads the sequence of tokens in order to create the nodes.
 */
export class Parser {
    /**
     * @constructs Parser
     * @param {Generator} tokens The list of tokens.
     */
    constructor(tokens) {
        this.tokens = Array.from(tokens);
        this.idx = -1;
        this.advancement_count = 0;
        this.backup_index = 0;
        this.advance();
    }

    backup() {
        this.backup_index = this.idx;
    }

    rescue() {
        this.idx = this.backup_index;
        this.backup_index = 0;
    }

    reset_advancement_count() {
        this.advancement_count = 0;
    }

    backwards(steps=1) {
        this.idx -= steps;
        this.advancement_count -= steps;
        if (this.idx < 0) this.idx = 0;
        if (this.advancement_count < 0) this.advancement_count = 0;
        this.set_token();
    }

    try(val) {
        this.advancement_count = 0;
        return val;
    }

    advance() {
        this.idx += 1;
        this.advancement_count += 1;
        this.set_token();
    }

    set_token() {
        /** @type {Token|null} */
        this.current_token = this.idx < this.tokens.length ? this.tokens[this.idx] : null;
    }

    parse() {
        if (this.current_token === null) {
            return null;
        }

        let result = this.statements();

        // not normal
        if (this.current_token !== null && this.current_token.type !== TokenType.EOF) {
            let pos_start = this.current_token.pos_start.copy();
            this.advance();
            let pos_end = this.current_token ? this.current_token.pos_end : pos_start.copy();
            if (this.current_token) {
                pos_end = this.current_token.pos_end;
            } else {
                pos_end = pos_start.copy();
                pos_end.advance(null);
            }
            throw new InvalidSyntaxError(pos_start, pos_end, "Unexpected end of parsing.");
        }

        return result;
    }
    
    statements() {
        let statements = [];
        let pos_start = this.current_token.pos_start.copy();

        while (this.current_token.type === TokenType.NEWLINE) {
            this.advance();
        }

        if (this.current_token.type === TokenType.EOF) {
            throw new InvalidSyntaxError(
                pos_start, this.current_token.pos_end,
                "Unexpected end of file"
            );
        }

        let statement = this.statement();
        statements.push(statement);

        let more_statements = true;

        while (true) {
            let newline_count = 0;
            while (this.current_token.type === TokenType.NEWLINE) {
                this.advance();
                newline_count++;
            }

            if (this.current_token.type === TokenType.EOF) break;

            // there are no more lines
            if (newline_count === 0) more_statements = false;
            if (!more_statements) break;
            
            if (this.current_token.matches(TokenType.KEYWORD, "elif")) {
                more_statements = false;
                continue;
            } else if (this.current_token.matches(TokenType.KEYWORD, "else")) {
                more_statements = false;
                continue;
            } else if (this.current_token.matches(TokenType.KEYWORD, "end")) {
                more_statements = false;
                continue;
            } else {
                statement = this.statement();

                if (!statement) {
                    more_statements = false;
                    continue;
                }

                statements.push(statement);
            }
        }

        return new ListNode(
            statements,
            pos_start,
            this.current_token.pos_end.copy()
        );
    }

    statement() {
        return this.expr();
    }

    expr() {
        if (this.current_token.matches(TokenType.KEYWORD, "var")) {
            let pos_start = this.current_token.pos_start;
            this.advance();
            
            if (this.current_token.type !== TokenType.IDENTIFIER) {
                throw new InvalidSyntaxError(
                    pos_start, this.current_token.pos_end,
                    "Expected identifier"
                );
            }
            
            const var_name_tok = this.current_token;
            this.advance();

            if (this.current_token.type !== TokenType.EQUALS) {
                throw new InvalidSyntaxError(
                    pos_start, this.current_token.pos_end,
                    "Expected equals"
                );
            }

            this.advance();
            const value_node = this.expr();

            return new VarAssignNode(var_name_tok, value_node);
        }

        let result = this.comp_expr();

        if (this.current_token !== null) {
            if (this.current_token.matches(TokenType.KEYWORD, "and")) {
                this.advance();
                let node = this.comp_expr();
                return new AndNode(result, node);
            } else if (this.current_token.matches(TokenType.KEYWORD, "or")) {
                this.advance();
                let node = this.comp_expr();
                return new OrNode(result, node);
            }
        }

        return result;
    }

    comp_expr() {
        if (this.current_token.matches(TokenType.KEYWORD, "not")) {
            this.advance();
            let node = this.comp_expr();
            return new NotNode(node);
        }

        let node_a = this.arith_expr();

        if (this.current_token.type === TokenType.DOUBLE_EQUALS) {
            this.advance();
            return new EqualsNode(node_a, this.arith_expr());
        } else if (this.current_token.type === TokenType.LT) {
            this.advance();
            return new LessThanNode(node_a, this.arith_expr());
        } else if (this.current_token.type === TokenType.GT) {
            this.advance();
            return new GreaterThanNode(node_a, this.arith_expr());
        } else if (this.current_token.type === TokenType.LTE) {
            this.advance();
            return new LessThanOrEqualNode(node_a, this.arith_expr());
        } else if (this.current_token.type === TokenType.GTE) {
            this.advance();
            return new GreaterThanOrEqualNode(node_a, this.arith_expr());
        } else if (this.current_token.type === TokenType.NOT_EQUAL) {
            this.advance();
            return new NotEqualsNode(node_a, this.arith_expr());
        } else if (this.current_token.type === TokenType.ELSE_ASSIGN) {
            this.advance();
            return new ElseAssignmentNode(node_a, this.arith_expr());
        }

        return node_a;
    }

    arith_expr() {
        let result = this.term();

        while (this.current_token !== null && is_in(this.current_token.type, [TokenType.PLUS, TokenType.MINUS])) {
            if (this.current_token.type === TokenType.PLUS) {
                this.advance();
                result = new AddNode(result, this.term());
            } else if (this.current_token.type === TokenType.MINUS) {
                this.advance();
                result = new SubtractNode(result, this.term());
            }
        }

        return result;
    }

    /**
     * @returns {CustomNode}
     */
    term() {
        let node_a = this.factor();
        let result;

        while (this.current_token !== null && is_in(this.current_token.type, [TokenType.MULTIPLY, TokenType.DIVIDE, TokenType.POWER, TokenType.MODULO])) {
            if (this.current_token.type === TokenType.MULTIPLY) {
                this.advance();
                result = new MultiplyNode(node_a, this.factor());
            } else if (this.current_token.type === TokenType.DIVIDE) {
                this.advance();
                result = new DivideNode(node_a, this.factor());
            } else if (this.current_token.type === TokenType.POWER) {
                this.advance();
                result = new PowerNode(node_a, this.factor());
            } else if (this.current_token.type === TokenType.MODULO) {
                this.advance();
                result = new ModuloNode(node_a, this.factor());
            }
        }

        return result ? result : node_a;
    }

    /**
     * @returns {CustomNode}
     */
    factor() {
        let pos_start = this.current_token.pos_start.copy();
        let token = this.current_token;

        if (token.type === TokenType.LPAREN) {
            this.advance();
            let result = this.expr();
            if (this.current_token.type !== TokenType.RPAREN) {
                throw new InvalidSyntaxError(pos_start, this.current_token.pos_end, "Expected ')'");
            }

            this.advance();
            return result;
        } else if (token.type === TokenType.NUMBER) {
            this.advance();
            return new NumberNode(token);
        } else if (token.type === TokenType.STRING) {
            this.advance();
            return new StringNode(token);
        } else if (token.type === TokenType.PLUS) {
            this.advance();
            return new PlusNode(this.factor());
        } else if (token.type === TokenType.MINUS) {
            this.advance();
            return new MinusNode(this.factor());
        } else if (token.type === TokenType.IDENTIFIER) {
            const var_name_tok = token;
            this.advance();
            if (this.current_token.type === TokenType.EQUALS) {
                if (is_in(var_name_tok.value, Object.keys(CONSTANTS))) {
                    throw new InvalidSyntaxError(
                        pos_start, this.current_token.pos_end,
                        "Invalid variable name for assigment."
                    );
                }

                this.advance();
                const value_node = this.expr();
                return new VarModifyNode(var_name_tok, value_node);
            } else if (this.current_token.type === TokenType.LSQUARE) {
                // list[(1+1)][index]
                let depth = -1;
                let index_nodes = [];
                let is_depth = false;
                let is_pushing = false; // is "list[]" ?

                while (this.current_token !== null && this.current_token.type !== TokenType.EOF) {
                    is_depth = false;

                    if (this.current_token.type === TokenType.LSQUARE) is_depth = true;
                    if (!is_depth) break;

                    this.advance();

                    // if "list[]"
                    if (this.current_token.type === TokenType.RSQUARE) {
                        // if it's already pushing
                        if (is_pushing) {
                            throw new InvalidSyntaxError(
                                this.current_token.pos_start, this.current_token.pos_end,
                                `Cannot push several times on the same list '${var_name_tok.value}'.`
                            );
                        }

                        index_nodes.push(new ListPushBracketsNode(var_name_tok));
                        is_pushing = true;
                    } else {
                        let index_pos_start = this.current_token.pos_start.copy();
                        let expr;
                        
                        // is it "[:3]" ? (is it already a semicolon)
                        if (this.current_token.type === TokenType.SEMICOLON) {
                            expr = null;
                        } else {
                            try {
                                expr = this.expr();
                            } catch(e) {
                                throw new InvalidSyntaxError(
                                    pos_start, index_pos_start,
                                    "Expected expression"
                                );
                            }
                        }

                        if (this.current_token.type === TokenType.SEMICOLON) {
                            this.advance();
                            
                            let right_expr;
                            if (this.current_token.type === TokenType.RSQUARE) {
                                right_expr = null;
                            } else {
                                try {
                                    right_expr = this.expr();
                                } catch(e) {
                                    throw new InvalidSyntaxError(
                                        pos_start, index_pos_start,
                                        "Expected expression or ']'"
                                    );
                                }
                            }

                            index_nodes.push(new ListBinarySelector(expr, right_expr, index_pos_start, this.current_token.pos_end));
                        } else {
                            index_nodes.push(expr);
                        }
                    }

                    if (this.current_token.type === TokenType.RSQUARE) depth++;
                    if (this.current_token.type === TokenType.EOF) {
                        throw new InvalidSyntaxError(
                            this.current_token.pos_start, this.current_token.pos_end,
                            "Expected ',', ':' or ']'"
                        );
                    }

                    this.advance();
                }

                const accessor = new ListAccessNode(var_name_tok, depth, index_nodes);

                if (this.current_token.type === TokenType.EQUALS) {
                    this.advance();
                    const value_node = this.expr();
                    return new ListAssignmentNode(accessor, value_node);
                } else if (is_pushing) {
                    throw new InvalidSyntaxError(
                        this.current_token.pos_start, this.current_token.pos_end,
                        "Expected '='"
                    );
                } else {
                    return accessor;
                }
            } else {
                return new VarAccessNode(token);
            }
        } else if (this.current_token.type === TokenType.LSQUARE) {
            let list_expr = this.list_expr();
            return list_expr;
        } else if (this.current_token.matches(TokenType.KEYWORD, "if")) {
            let if_expr = this.if_expr();
            return if_expr;
        } else if (this.current_token.matches(TokenType.KEYWORD, "for")) {
            let for_expr = this.for_expr();
            return for_expr;
        } else if (this.current_token.matches(TokenType.KEYWORD, "while")) {
            let while_expr = this.while_expr();
            return while_expr;
        } else {
            this.advance();
            throw new InvalidSyntaxError(pos_start, this.current_token.pos_end, "Unexpected node");
        }
    }

    list_expr() {
        let element_nodes = [];
        let pos_start = this.current_token.pos_start.copy();
        this.advance();

        // if the list is empty ("[]")
        if (this.current_token.type === TokenType.RSQUARE) {
            this.advance();
        } else {
            // we have values in the list
            // it's actually the same as getting arguments from the call method
            element_nodes.push(this.expr());

            while (this.current_token.type === TokenType.COMMA) {
                this.advance();
                element_nodes.push(this.expr());
            }

            if (this.current_token.type !== TokenType.RSQUARE) {
                throw new InvalidSyntaxError(
                    this.current_token.pos_start, this.current_token.pos_end,
                    "Expected ',', or ']'"
                );
            }

            this.advance();
        }

        return new ListNode(
            element_nodes,
            pos_start,
            this.current_token.pos_end.copy()
        );
    }

    if_expr() {
        const all_cases = this.if_expr_cases("if");
        const cases = all_cases.cases;
        const else_case = all_cases.else_case;
        return new IfNode(cases, else_case);
    }

    /**
     * Gets the cases of a condition, including: "if", "elif" and "else"
     * @param {string} case_keyword The keyword for a case ("if" or "elif").
     * @returns {{cases, else_case: {code, should_return_null: boolean}}}
     */
    if_expr_cases(case_keyword) {
        let cases = [];
        let else_case = { code: null, should_return_null: false };

        // we must have a "if" (or "elif")

        if (!this.current_token.matches(TokenType.KEYWORD, case_keyword)) {
            throw new InvalidSyntaxError(
                this.current_token.pos_start, this.current_token.pos_end,
                `Expected '${case_keyword}'`
            );
        }

        // we continue

        this.advance();
        let condition = this.expr();

        // we must have a semicolon

        if (this.current_token.type !== TokenType.SEMICOLON) {
            throw new InvalidSyntaxError(
                this.current_token.pos_start, this.current_token.pos_end,
                "Expected ':'"
            );
        }

        this.advance();

        if (this.current_token.type === TokenType.NEWLINE) {
            this.advance();

            let statements = this.statements();

            // true = should return null?
            // before, we returned the evaluated expr
            // now if we are on several lines, we don't want to return anything
            cases.push([condition, statements, true]);

            if (this.current_token.matches(TokenType.KEYWORD, "end")) {
                this.advance();
            } else {
                // there might be elifs
                const all_cases = this.if_expr_elif_or_else();
                let new_cases = all_cases.cases;
                else_case = all_cases.else_case;

                if (new_cases.length > 0) {
                    cases = [...cases, ...new_cases];
                }
            }
        } else {
            // inline condition
            let statement = this.statement();
            cases.push([condition, statement, false]); // we want the return value of a if statement (that's why false)

            const all_cases = this.if_expr_elif_or_else();
            let new_cases = all_cases.cases;
            else_case = all_cases.else_case;

            if (new_cases.length > 0) {
                cases = [...cases, ...new_cases];
            }
        }

        return { cases, else_case };
    }

    /**
     * Checks if there is `elif` cases or an `else` case
     * @returns {{cases, else_case: {code, should_return_null: boolean}}}
     */
    if_expr_elif_or_else() {
        let cases = [];
        let else_case = { code: null, should_return_null: false };

        if (this.current_token.matches(TokenType.KEYWORD, "elif")) {
            const all_cases = this.if_expr_elif();
            cases = all_cases.cases;
            else_case = all_cases.else_case;
        } else {
            else_case = this.if_expr_else();
        }

        return { cases, else_case };
    }

    /**
     * Checks if there is an `elif` case.
     * @returns {{cases, else_case: {code, should_return_null: boolean}}}
     */
    if_expr_elif() {
        return this.if_expr_cases("elif"); // same as "if"
    }

    /**
     * Checks if there is an `else` case.
     * @returns {{code, should_return_null: boolean}}
     */
    if_expr_else() {
        let else_case = { code: null, should_return_null: false };
        
        if (this.current_token.matches(TokenType.KEYWORD, "else")) {
            this.advance();

            if (this.current_token.type === TokenType.SEMICOLON) {
                this.advance();
            } else {
                throw new InvalidSyntaxError(
                    this.current_token.pos_start, this.current_token.pos_end,
                    "Expected ':'"
                );
            }

            if (this.current_token.type === TokenType.NEWLINE) {
                this.advance();
                
                let statements = this.statements();
                else_case = { code: statements, should_return_null: true };

                if (this.current_token.matches(TokenType.KEYWORD, "end")) {
                    this.advance();
                } else {
                    throw new InvalidSyntaxError(
                        this.current_token.pos_start, this.current_token.pos_end,
                        "Expected 'end'"
                    );
                }
            } else {
                let statement = this.statement();
                else_case = { code: statement, should_return_null: false };
            }
        }

        return else_case;
    }

    for_expr() {
        this.advance();

        // after the "for" keyword,
        // we start with an identifier (i)

        if (this.current_token.type !== TokenType.IDENTIFIER) {
            throw new InvalidSyntaxError(
                this.current_token.pos_start, this.current_token.pos_end,
                "Expected identifier"
            );
        }

        let var_name_token = this.current_token;
        this.advance();

        // the variable i needs to have a value,
        // so there must be an equal token

        let start_value = null;

        if (this.current_token.type === TokenType.EQUALS) {
            // after the equal token, we expect an expr
            this.advance();
            start_value = this.expr();
        }

        // after the expr, we expect a `to` keyword

        if (!this.current_token.matches(TokenType.KEYWORD, "to")) {
            throw new InvalidSyntaxError(
                this.current_token.pos_start, this.current_token.pos_end,
                "Expected 'to'"
            );
        }

        this.advance();

        // The `to` keyword indicated the end value

        let end_value = this.expr();

        // we could have a `step` keyword afterwards

        let step_value = null;
        if (this.current_token.matches(TokenType.KEYWORD, "step")) {
            this.advance();
            step_value = this.expr();
        }

        if (this.current_token.type !== TokenType.SEMICOLON) {
            throw new InvalidSyntaxError(
                this.current_token.pos_start, this.current_token.pos_end,
                "Expected ':'"
            );
        }

        this.advance();

        if (this.current_token.type === TokenType.NEWLINE) {
            this.advance();

            let extended_body = this.statements();

            if (!this.current_token.matches(TokenType.KEYWORD, "end")) {
                throw new InvalidSyntaxError(
                    this.current_token.pos_start, this.current_token.pos_end,
                    "Expected 'end'"
                );
            }

            this.advance();

            return new ForNode(
                var_name_token,
                start_value,
                end_value,
                step_value,
                extended_body,
                true // should return null
            );
        }

        // now there is the body of the statement
        // for an inline loop

        let body = this.statement();

        return new ForNode(
            var_name_token,
            start_value,
            end_value,
            step_value,
            body,
            false
        );
    }

    while_expr() {
        this.advance();

        // after the `while` keyword, there must be an expression

        let condition = this.expr();

        // after the condition, we expect a ":"

        if (this.current_token.type !== TokenType.SEMICOLON) {
            throw new InvalidSyntaxError(
                this.current_token.pos_start, this.current_token.pos_end,
                "Expected ':'"
            );
        }

        this.advance();

        if (this.current_token.type === TokenType.NEWLINE) {
            this.advance();

            let extended_body = this.statements();

            if (!this.current_token.matches(TokenType.KEYWORD, "end")) {
                throw new InvalidSyntaxError(
                    this.current_token.pos_start, this.current_token.pos_end,
                    "Expected 'end'"
                );
            }

            this.advance();

            return new WhileNode(
                condition,
                extended_body,
                true // should return null? True
            );
        }

        let body = this.statement();

        return new WhileNode(
            condition,
            body,
            false
        );
    }
}