import { TokenType, Token } from "./tokens.js";
import { CustomNode, AddNode, DivideNode, MinusNode, ModuloNode, MultiplyNode, NumberNode, PlusNode, PowerNode, SubtractNode, VarAssignNode, VarAccessNode, VarModifyNode, OrNode, NotNode, AndNode, EqualsNode, LessThanNode, LessThanOrEqualNode, GreaterThanNode, GreaterThanOrEqualNode, NotEqualsNode, ElseAssignmentNode, ListNode, ListAccessNode, ListAssignmentNode, ListPushBracketsNode, ListBinarySelector, StringNode, IfNode, ForNode, WhileNode, FuncDefNode, CallNode, ReturnNode, ContinueNode, BreakNode, DefineNode, DeleteNode, PrefixOperationNode, PostfixOperationNode, DictionnaryElementNode, DictionnaryNode, ForeachNode, ClassPropertyDefNode, ClassMethodDefNode, ClassDefNode, ClassCallNode, CallPropertyNode, AssignPropertyNode, CallMethodNode } from "./nodes.js";
import { InvalidSyntaxError, RuntimeError } from "./Exceptions.js";
import { NumberValue } from "./values.js";
import { is_in } from "./miscellaneous.js";
import { Position } from "./position.js";

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

    // \n, \r\n or ;
    is_newline() {
        return this.current_token.type === TokenType.NEWLINE || this.current_token.type === TokenType.SEMICOLON;
    }

    // we just want to avoid the newlines (\n)
    // but not the semicolons.
    // That allows us to make the difference between the wanted syntax of the user
    // and a syntax error (a semicolon inside a list declaration for example).
    // Let's take:
    // `return;` // i.e. end of statement
    // However, we might have:
    // ```
    // return
    //     (5 + 5)
    // ```
    ignore_newlines() {
        while (this.current_token.type === TokenType.NEWLINE) {
            this.advance();
        }
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

        while (this.is_newline()) {
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
            while (this.is_newline()) {
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
        let pos_start = this.current_token.pos_start.copy();

        if (this.current_token.matches(TokenType.KEYWORD, "return")) {
            this.advance();
            this.ignore_newlines();

            let expr = null;
            if (!this.is_newline() && this.current_token.type !== TokenType.EOF) expr = this.expr();
            
            return new ReturnNode(expr, pos_start, this.current_token.pos_end.copy());
        }

        if (this.current_token.matches(TokenType.KEYWORD, "continue")) {
            this.advance();
            return new ContinueNode(pos_start, this.current_token.pos_end.copy());
        }

        if (this.current_token.matches(TokenType.KEYWORD, "break")) {
            this.advance();
            return new BreakNode(pos_start, this.current_token.pos_end.copy());
        }

        if (this.current_token.matches(TokenType.KEYWORD, "class")) {
            let class_expr = this.class_expr();
            return class_expr;
        }

        return this.expr();
    }
    
    class_expr() {
        let class_pos_start = this.current_token.pos_start.copy();
        this.advance();

        if (this.current_token.type !== TokenType.IDENTIFIER) {
            throw new InvalidSyntaxError(
                class_pos_start, this.current_token.pos_end,
                "Expected an identifier"
            );
        }

        let class_name_tok = this.current_token;
        let properties = [];
        let methods = [];
        let getters = [];
        let setters = [];
        let parent_class_tok;

        this.advance();

        if (this.current_token.matches(TokenType.KEYWORD, "extends")) {
            this.advance();
            if (this.current_token.type !== TokenType.IDENTIFIER) {
                throw new InvalidSyntaxError(
                    this.current_token.pos_start, this.current_token.pos_end,
                    "Expected an identifier"
                );
            }
            parent_class_tok = this.current_token;
            this.advance();
        }

        if (this.current_token.type !== TokenType.COLON) {
            throw new InvalidSyntaxError(
                class_pos_start, this.current_token.pos_end,
                "Expected ':'"
            );
        }

        let class_pos_end = this.current_token.pos_end.copy();

        this.advance();
        this.ignore_newlines();

        const is_public = () => this.current_token.matches(TokenType.KEYWORD, "public");
        const is_private = () => this.current_token.matches(TokenType.KEYWORD, "private");
        const is_protected = () => this.current_token.matches(TokenType.KEYWORD, "protected");
        const is_override = () => this.current_token.matches(TokenType.KEYWORD, "override");
        const is_property = () => this.current_token.matches(TokenType.KEYWORD, "property");
        const is_method = () => this.current_token.matches(TokenType.KEYWORD, "method");
        const is_setter = () => this.current_token.matches(TokenType.KEYWORD, "set");
        const is_getter = () => this.current_token.matches(TokenType.KEYWORD, "get");

        while (
            is_private() ||
            is_public() ||
            is_protected() ||
            is_override() ||
            is_property() ||
            is_method() ||
            is_setter() ||
            is_getter()
        ) {
            let status = 1;
            if (is_private()) status = 0;
            if (is_protected()) status = 2;

            let override = is_override() ? 1 : 0;

            if (
                is_private() ||
                is_public() ||
                is_protected() ||
                is_override()
            ) {
                this.advance();
            }

            if (is_getter() || is_setter() || is_method()) {
                let is_get = is_getter();
                let is_set = is_setter();
                let is_met = is_method();

                let pos_start = this.current_token.pos_start.copy();
                let pos_end = this.current_token.pos_end.copy();
                let func_expr = this.func_expr();
                if (func_expr.var_name_tok === null) {
                    throw new InvalidSyntaxError(
                        pos_start, pos_end,
                        "Expected an identifier"
                    );
                }
                let node = new ClassMethodDefNode(
                    func_expr,
                    status,
                    override
                );
                if (is_get) getters.push(node);
                if (is_set) setters.push(node);
                if (is_met) methods.push(node);
                this.advance()
                this.ignore_newlines();
            }

            if (is_property()) { // property
                let property_pos_start = this.current_token.pos_start.copy();
                this.advance();
                if (this.current_token.type !== TokenType.IDENTIFIER) {
                    throw new InvalidSyntaxError(
                        property_pos_start, this.current_token.pos_end,
                        "Expected an identifier"
                    );
                }
                let property_name_tok = this.current_token;
                let property_pos_end = this.current_token.pos_end.copy();
                this.advance();
                let value_node;
                if (this.current_token.type === TokenType.EQUALS) {
                    this.advance();
                    value_node = this.expr();
                } else {
                    value_node = new NumberNode(new Token(TokenType.NUMBER, NumberValue.none.value, property_pos_start, property_pos_end))
                }
                let property_def_node = new ClassPropertyDefNode(property_name_tok, value_node, status, override);
                properties.push(property_def_node);
                this.advance();
                this.ignore_newlines();
            }
        }

        if (!this.current_token.matches(TokenType.KEYWORD, "end")) {
            throw new InvalidSyntaxError(
                this.current_token.pos_start, this.current_token.pos_end,
                "Expected 'end'"
            );
        }

        this.advance();

        return new ClassDefNode(
            class_name_tok,
            parent_class_tok,
            properties,
            methods,
            getters,
            setters,
            class_pos_start,
            class_pos_end,
        );
    }

    expr() {
        if (this.current_token.matches(TokenType.KEYWORD, "var") || this.current_token.matches(TokenType.KEYWORD, "define")) {
            let is_variable = this.current_token.matches(TokenType.KEYWORD, "var");
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

            if (is_variable) {
                return new VarAssignNode(var_name_tok, value_node);
            } else {
                return new DefineNode(var_name_tok, value_node);
            }
        } else if (this.current_token.matches(TokenType.KEYWORD, "delete")) {
            let pos_start = this.current_token.pos_start;
            this.advance();

            let node_to_delete = this.call(); // I don't want to delete properties, so not `this.prop()`

            return new DeleteNode(node_to_delete, pos_start, node_to_delete.pos_end);
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

        while (this.current_token !== null && is_in(this.current_token.type, [TokenType.PLUS, TokenType.MINUS, TokenType.INC, TokenType.DEC])) {
            if (this.current_token.type === TokenType.PLUS) {
                this.advance();
                if (this.current_token.type === TokenType.EQUALS) { // +=
                    this.advance();
                    if (result instanceof VarAccessNode) {
                        return new VarModifyNode(result.var_name_tok, new AddNode(result, this.expr()));
                    } else if (result instanceof ListAccessNode) {
                        return new ListAssignmentNode(result, new AddNode(result, this.expr()));
                    } else {
                        throw new InvalidSyntaxError(
                            result.pos_start, this.current_token.pos_end,
                            "Expected a variable"
                        );
                    }
                }
                result = new AddNode(result, this.term());
            } else if (this.current_token.type === TokenType.MINUS) { // -=
                this.advance();
                if (this.current_token.type === TokenType.EQUALS) {
                    this.advance();
                    if (result instanceof VarAccessNode) {
                        return new VarModifyNode(result.var_name_tok, new SubtractNode(result, this.expr()));
                    } else if (result instanceof ListAccessNode) {
                        return new ListAssignmentNode(result, new SubtractNode(result, this.expr()));
                    } else {
                        throw new InvalidSyntaxError(
                            result.pos_start, this.current_token.pos_end,
                            "Expected a variable"
                        );
                    }
                }
                result = new SubtractNode(result, this.term());
            } else if (this.current_token.type === TokenType.INC) { // a++
                this.advance();
                let difference = 1;
                while (this.current_token.type === TokenType.INC) {
                    difference++;
                    this.advance();
                }
                if (result instanceof ListAccessNode) {
                    return new ListAssignmentNode(result, new AddNode(result, new NumberNode(new Token(TokenType.NUMBER, difference))));
                }
                return new PostfixOperationNode(result, difference);
            } else if (this.current_token.type === TokenType.DEC) { // b--
                this.advance();
                let difference = -1;
                while (this.current_token.type === TokenType.DEC) {
                    difference--;
                    this.advance();
                }
                if (result instanceof ListAccessNode) {
                    return new ListAssignmentNode(result, new AddNode(result, new NumberNode(new Token(TokenType.NUMBER, difference))));
                }
                return new PostfixOperationNode(result, difference);
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
                if (this.current_token.type === TokenType.EQUALS) { // *=
                    this.advance();
                    if (node_a instanceof VarAccessNode) {
                        return new VarModifyNode(node_a.var_name_tok, new MultiplyNode(node_a, this.expr()));
                    } else if (node_a instanceof ListAccessNode) {
                        return new ListAssignmentNode(node_a, new MultiplyNode(node_a, this.expr()));
                    } else {
                        throw new InvalidSyntaxError(
                            node_a.pos_start, this.current_token.pos_end,
                            "Expected a variable"
                        );
                    }
                }
                result = new MultiplyNode(result ? result : node_a, this.factor());
            } else if (this.current_token.type === TokenType.DIVIDE) {
                this.advance();
                if (this.current_token.type === TokenType.EQUALS) { // /=
                    this.advance();
                    if (node_a instanceof VarAccessNode) {
                        return new VarModifyNode(node_a.var_name_tok, new DivideNode(node_a, this.expr()));
                    } else if (node_a instanceof ListAccessNode) {
                        return new ListAssignmentNode(node_a, new DivideNode(node_a, this.expr()));
                    } else {
                        throw new InvalidSyntaxError(
                            node_a.pos_start, this.current_token.pos_end,
                            "Expected a variable"
                        );
                    }
                }
                result = new DivideNode(result ? result : node_a, this.factor());
            } else if (this.current_token.type === TokenType.POWER) {
                this.advance();
                if (this.current_token.type === TokenType.EQUALS) { // ^=
                    this.advance();
                    if (node_a instanceof VarAccessNode) {
                        return new VarModifyNode(node_a.var_name_tok, new PowerNode(node_a, this.expr()));
                    } else if (node_a instanceof ListAccessNode) {
                        return new ListAssignmentNode(node_a, new PowerNode(node_a, this.expr()));
                    } else {
                        throw new InvalidSyntaxError(
                            node_a.pos_start, this.current_token.pos_end,
                            "Expected a variable"
                        );
                    }
                }
                result = new PowerNode(result ? result : node_a, this.factor());
            } else if (this.current_token.type === TokenType.MODULO) {
                this.advance();
                if (this.current_token.type === TokenType.EQUALS) { // %=
                    this.advance();
                    if (node_a instanceof VarAccessNode) {
                        return new VarModifyNode(node_a.var_name_tok, new ModuloNode(node_a, this.expr()));
                    } else if (node_a instanceof ListAccessNode) {
                        return new ListAssignmentNode(node_a, new ModuloNode(node_a, this.expr()));
                    } else {
                        throw new InvalidSyntaxError(
                            node_a.pos_start, this.current_token.pos_end,
                            "Expected a variable"
                        );
                    }
                }
                result = new ModuloNode(result ? result : node_a, this.factor());
            }
        }

        return result ? result : node_a;
    }

    factor() {
        let token = this.current_token;

        if (token.type === TokenType.PLUS) {
            this.advance();
            return new PlusNode(this.prop());
        } else if (token.type === TokenType.MINUS) {
            this.advance();
            return new MinusNode(this.prop());
        } else if (this.current_token.type === TokenType.INC) { // ++expr
            this.advance();
            let difference = 1;
            while (this.current_token.type === TokenType.INC) {
                difference++;
                this.advance();
            }
            let expr = this.term();
            return new PrefixOperationNode(expr, difference);
        } else if (this.current_token.type === TokenType.DEC) { // --expr
            this.advance();
            let difference = -1;
            while (this.current_token.type === TokenType.DEC) {
                difference--;
                this.advance();
            }
            let expr = this.term();
            return new PrefixOperationNode(expr, difference);
        } else {
            return this.prop();
        }
    }

    prop() {
        let node_to_call = this.call();
        
        // if we have a dot after our atom
        // that means we are calling the atom (and that this atom is a ClassValue)

        if (this.current_token.type === TokenType.DOT) {
            let is_calling = false;
            let result;

            while (this.current_token !== null && this.current_token.type !== TokenType.EOF) {
                is_calling = false;

                if (this.current_token.type === TokenType.DOT) is_calling = true;
                if (!is_calling) break;

                
                this.advance();
                this.ignore_newlines();
                
                if (this.current_token.type === TokenType.DOT) {
                    throw new InvalidSyntaxError(
                        this.current_token.pos_start, this.current_token.pos_end,
                        "Cannot follow two dots in a row"
                    );
                } else if (this.current_token.type !== TokenType.IDENTIFIER) {
                    throw new InvalidSyntaxError(
                        this.current_token.pos_start, this.current_token.pos_end,
                        "Expected identifier"
                    );
                }

                let property_tok = this.current_token;

                this.advance();

                let call_node = new CallPropertyNode(result ? result : node_to_call, property_tok);

                if (this.current_token.type === TokenType.LPAREN) {
                    result = new CallMethodNode(this.helper_call_func(call_node), node_to_call); // node_to_call will have to be an instance of ClassValue
                } else if (this.current_token.type === TokenType.LSQUARE) {
                    result = this.helper_call_list(call_node)
                } else {
                    result = call_node;
                }
            }

            if (this.current_token.type === TokenType.EQUALS) {
                if (!(result instanceof CallPropertyNode)) {
                    throw new InvalidSyntaxError(
                        this.current_token.pos_start, this.current_token.pos_end,
                        "Unable to assign a new value for that call.",
                    );
                }
                this.advance();
                let value_node = this.expr();
                return new AssignPropertyNode(result, value_node);
            }

            return result;
        }

        return node_to_call;
    }

    call() {
        if (this.current_token.matches(TokenType.KEYWORD, "new")) {
            let pos_start = this.current_token.pos_start.copy();
            this.advance();
            if (this.current_token.type !== TokenType.IDENTIFIER) {
                throw new InvalidSyntaxError(
                    pos_start, this.current_token.pos_end,
                    "Expected an identifier"
                );
            }
            
            let class_name_tok = this.current_token;
            this.advance();
            if (this.current_token.type !== TokenType.LPAREN) {
                throw new InvalidSyntaxError(
                    pos_start, this.current_token.pos_end,
                    "Expected '('"
                );
            }

            this.advance();
            this.ignore_newlines();

            let arg_nodes = [];
            if (this.current_token.type === TokenType.RPAREN) {
                this.advance();
            } else {
                arg_nodes.push(this.expr());
                this.ignore_newlines();

                while (this.current_token.type === TokenType.COMMA) {
                    this.advance();
                    this.ignore_newlines();
                    arg_nodes.push(this.expr());
                }

                this.ignore_newlines();

                if (this.current_token.type !== TokenType.RPAREN) {
                    throw new InvalidSyntaxError(
                        this.current_token.pos_start, this.current_token.pos_end,
                        "Expected ',' or ')'"
                    );
                }

                this.advance();
            }

            return new ClassCallNode(class_name_tok, arg_nodes);
        }

        let atom = this.atom();
        let pos_start = this.current_token.pos_start.copy();
        let result;
        
        while (this.current_token.type === TokenType.LPAREN || this.current_token.type === TokenType.LSQUARE) {
            if (this.current_token.type === TokenType.LPAREN) {
                result = this.helper_call_func(result ? result : atom);
            } else if (this.current_token.type === TokenType.LSQUARE) {
                result = this.helper_call_list(result ? result : atom, pos_start);
            }
        }

        return result ? result : atom;
    }

    /**
     * grammar: `call_list`
     * @param {CustomNode} atom 
     * @param {Position|null} pos_start 
     */
    helper_call_list(atom, pos_start=null) {
        // if we have a left square bracket after our atom
        // that means we are trying to get an element in a list

        if (this.current_token.type === TokenType.LSQUARE) {
            // list[(1+1)][index]
            let depth = -1;
            let index_nodes = [];
            let is_depth = false;
            let is_pushing = false; // is "list[]" ?

            while (this.current_token !== null && this.current_token.type !== TokenType.EOF) {
                is_depth = false;

                if (this.current_token.type === TokenType.LSQUARE) is_depth = true;
                if (!is_depth) break;
                if (is_pushing) {
                    throw new InvalidSyntaxError(
                        this.current_token.pos_start, this.current_token.pos_end,
                        `Expected '='`
                    );
                }

                this.advance();
                this.ignore_newlines();

                // if "list[]"
                if (this.current_token.type === TokenType.RSQUARE) {
                    index_nodes.push(new ListPushBracketsNode(pos_start, this.current_token.pos_end));
                    is_pushing = true;
                } else {
                    let index_pos_start = this.current_token.pos_start.copy();
                    let expr;
                    
                    // is it "[:3]" ? (is it already a colon)
                    if (this.current_token.type === TokenType.COLON) {
                        expr = null;
                    } else {
                        try {
                            expr = this.expr();
                            this.ignore_newlines();
                        } catch(e) {
                            throw new InvalidSyntaxError(
                                pos_start, index_pos_start,
                                "Expected expression"
                            );
                        }
                    }

                    if (this.current_token.type === TokenType.COLON) {
                        this.advance();
                        
                        let right_expr;
                        if (this.current_token.type === TokenType.RSQUARE) {
                            right_expr = null;
                        } else {
                            try {
                                right_expr = this.expr();
                                this.ignore_newlines();
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

            const accessor = new ListAccessNode(atom, depth, index_nodes);

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
        }

        return atom;
    }

    /**
     * grammar: `call_func`
     * @param {CustomNode} atom 
     * @param {Position|null} pos_start 
     */
    helper_call_func(atom, pos_start=null) {
        // if we have a left parenthesis after our atom
        // that means we are calling the atom

        if (this.current_token.type === TokenType.LPAREN) {
            let is_calling = false;
            let result;

            while (this.current_token !== null && this.current_token.type !== TokenType.EOF) {
                let arg_nodes = [];
                is_calling = false;

                if (this.current_token.type === TokenType.LPAREN) is_calling = true;
                if (!is_calling) break;

                this.advance();
                this.ignore_newlines();

                if (this.current_token.type === TokenType.RPAREN) {
                    this.advance();
                } else {
                    try {
                        arg_nodes.push(this.expr());
                        this.ignore_newlines();
                    } catch(e) {
                        throw new InvalidSyntaxError(
                            this.current_token.pos_start, this.current_token.pos_end,
                            "Expected an expression or ')'"
                        );
                    }

                    while (this.current_token.type === TokenType.COMMA) {
                        this.advance();
                        this.ignore_newlines();
                        arg_nodes.push(this.expr());
                    }

                    this.ignore_newlines();

                    if (this.current_token.type !== TokenType.RPAREN) {
                        throw new InvalidSyntaxError(
                            this.current_token.pos_start, this.current_token.pos_end,
                            "Expected ',' or ')'"
                        );
                    }

                    this.advance();
                }

                result = new CallNode(result ? result : atom, arg_nodes);
            }

            return result;
        }

        return atom;
    }
    
    /**
     * @returns {CustomNode}
     */
    atom() {
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
        } else if (token.type === TokenType.IDENTIFIER) {
            const var_name_tok = token;
            this.advance();

            if (var_name_tok.value === "f" && this.current_token.type === TokenType.STRING) {
                const string = this.current_token;
                this.advance();
                return new StringNode(string, true);
            }

            if (this.current_token.type === TokenType.EQUALS) {
                this.advance();
                const value_node = this.expr();
                return new VarModifyNode(var_name_tok, value_node);
            }

            return new VarAccessNode(token);
        } else if (this.current_token.type === TokenType.LSQUARE) {
            let list_expr = this.list_expr();
            return list_expr;
        } else if (this.current_token.type === TokenType.LBRACK) {
            let dict_expr = this.dict_expr();
            return dict_expr;
        } else if (this.current_token.matches(TokenType.KEYWORD, "if")) {
            let if_expr = this.if_expr();
            return if_expr;
        } else if (this.current_token.matches(TokenType.KEYWORD, "for")) {
            let for_expr = this.for_expr();
            return for_expr;
        } else if (this.current_token.matches(TokenType.KEYWORD, "foreach")) {
            let foreach_expr = this.foreach_expr();
            return foreach_expr;
        } else if (this.current_token.matches(TokenType.KEYWORD, "while")) {
            let while_expr = this.while_expr();
            return while_expr;
        } else if (this.current_token.matches(TokenType.KEYWORD, "func")) {
            let func_expr = this.func_expr();
            return func_expr;
        } else {
            this.advance();
            let pos_end = pos_start.copy();
            if (this.current_token) {
                pos_end = this.current_token.pos_end
            }
            throw new InvalidSyntaxError(pos_start, pos_end, "Unexpected node");
        }
    }

    // ----

    list_expr() {
        let element_nodes = [];
        let pos_start = this.current_token.pos_start.copy();
        this.advance();
        this.ignore_newlines();

        // if the list is empty ("[]")
        if (this.current_token.type === TokenType.RSQUARE) {
            this.advance();
        } else {
            // we have values in the list
            // it's actually the same as getting arguments from the call method
            element_nodes.push(this.expr());
            this.ignore_newlines();

            while (this.current_token.type === TokenType.COMMA) {
                this.advance();
                this.ignore_newlines();
                if (this.current_token.type === TokenType.RSQUARE) break;
                element_nodes.push(this.expr());
                this.ignore_newlines();
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

    dict_expr() {
        let dict_element_nodes = [];
        let pos_start = this.current_token.pos_start.copy();
        let pos_end;
        this.advance();
        this.ignore_newlines();

        // if the dictionnary is empty ("{}")
        if (this.current_token.type === TokenType.RBRACK) {
            this.advance();
        } else {
            const read_element = () => {
                // we have values in the dictionnary
                let key = this.expr();
                this.ignore_newlines();

                if (key instanceof StringNode) {
                    if (this.current_token.type !== TokenType.COLON) {
                        throw new InvalidSyntaxError(
                            pos_start, this.current_token.pos_end,
                            "Expected a colon (':')"
                        );
                    }

                    this.advance();
                    this.ignore_newlines();

                    let value = this.expr();
                    this.ignore_newlines();
                    let element = new DictionnaryElementNode(key, value);
                    dict_element_nodes.push(element);
                } else if (key instanceof VarAccessNode) {
                    // if this is a variable, we want its name to become the key and its value to become the value of this key
                    // var age = 17; var dico = { age, name: "thomas" }

                    // the user had to use a string
                    // because he's trying to do: `{ age: 17 }`
                    if (this.current_token.type === TokenType.COLON) {
                        throw new InvalidSyntaxError(
                            pos_start, this.current_token.pos_end,
                            "Expected a comma, or change the key to a string"
                        );
                    }

                    // we don't need to advance

                    // we'll do a little trick
                    // => the key becomes the name of the variable
                    // the value becomes the key (an instance of VarAccessNode)
                    // therefore, during interpretation, we'll have: { "age": age }
                    let key_string = new StringNode(key.var_name_tok);
                    let value = key;
                    let element = new DictionnaryElementNode(key_string, value);
                    dict_element_nodes.push(element);
                } else {
                    throw new InvalidSyntaxError(
                        key.pos_start, key.pos_end,
                        "Expected a string or an identifier as key"
                    );
                }
            };

            read_element();

            while (this.current_token.type === TokenType.COMMA) {
                this.advance();
                this.ignore_newlines();
                if (this.current_token.type === TokenType.RBRACK) break;
                read_element();
            }

            this.ignore_newlines();

            if (this.current_token.type !== TokenType.RBRACK) {
                throw new InvalidSyntaxError(
                    this.current_token.pos_start, this.current_token.pos_end,
                    "Expected ',' or '}'"
                );
            }

            pos_end = this.current_token.pos_end.copy();

            this.advance();
        }

        return new DictionnaryNode(
            dict_element_nodes,
            pos_start,
            pos_end
        );
    }

    if_expr() {
        const pos_start = this.current_token.pos_start.copy();
        const all_cases = this.if_expr_cases("if");
        const cases = all_cases.cases;
        const else_case = all_cases.else_case;
        let pos_end;
        if (else_case.code) {
            pos_end = else_case.code.pos_end;
        } else {
            pos_end = cases[cases.length - 1][0].pos_end;
        }
        return new IfNode(cases, else_case, pos_start, pos_end);
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

        // we must have a colon

        if (this.current_token.type !== TokenType.COLON) {
            throw new InvalidSyntaxError(
                this.current_token.pos_start, this.current_token.pos_end,
                "Expected ':'"
            );
        }

        this.advance();

        if (this.is_newline()) {
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

            if (this.current_token.type === TokenType.COLON) {
                this.advance();
            } else {
                throw new InvalidSyntaxError(
                    this.current_token.pos_start, this.current_token.pos_end,
                    "Expected ':'"
                );
            }

            if (this.is_newline()) {
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

        if (this.current_token.type !== TokenType.COLON) {
            throw new InvalidSyntaxError(
                this.current_token.pos_start, this.current_token.pos_end,
                "Expected ':'"
            );
        }

        this.advance();

        if (this.is_newline()) {
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

    foreach_expr() {
        let pos_start = this.current_token.pos_start.copy();
        this.advance();

        // after the "foreach" keyword,
        // we start with a loop

        let list_node = this.prop();

        if (!this.current_token.matches(TokenType.KEYWORD, "as")) {
            throw new InvalidSyntaxError(
                this.current_token.pos_start, this.current_token.pos_end,
                "Expected 'as'"
            );
        }

        this.advance();

        if (this.current_token.type !== TokenType.IDENTIFIER) {
            throw new InvalidSyntaxError(
                this.current_token.pos_start, this.current_token.pos_end,
                "Expected an identifier"
            );
        }

        let var_name_tok = this.current_token;

        this.advance();

        let value_name_tok;
        if (this.current_token.type === TokenType.DOUBLE_ARROW) {
            this.advance();
            value_name_tok = this.current_token;
            this.advance();
        }

        if (this.current_token.type !== TokenType.COLON) {
            throw new InvalidSyntaxError(
                this.current_token.pos_start, this.current_token.pos_end,
                "Expected a colon ':'"
            );
        }

        this.advance();

        if (this.is_newline()) {
            this.advance();

            let extended_body = this.statements();

            if (!this.current_token.matches(TokenType.KEYWORD, "end")) {
                throw new InvalidSyntaxError(
                    this.current_token.pos_start, this.current_token.pos_end,
                    "Expected 'end'"
                );
            }

            this.advance();

            return new ForeachNode(
                list_node,
                value_name_tok ? var_name_tok : null,
                value_name_tok ? value_name_tok : var_name_tok,
                extended_body,
                true,
                pos_start,
                extended_body.pos_end
            );
        }

        let body = this.statement();

        return new ForeachNode(
            list_node,
            value_name_tok ? var_name_tok : null,
            value_name_tok ? value_name_tok : var_name_tok,
            body,
            false,
            pos_start,
            body.pos_end
        );
    }

    while_expr() {
        this.advance();

        // after the `while` keyword, there must be an expression

        let condition = this.expr();

        // after the condition, we expect a ":"

        if (this.current_token.type !== TokenType.COLON) {
            throw new InvalidSyntaxError(
                this.current_token.pos_start, this.current_token.pos_end,
                "Expected ':'"
            );
        }

        this.advance();

        if (this.is_newline()) {
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

    func_expr() {
        this.advance();

        // there might be no identifier (anonymous function)

        let var_name_token = null;
        if (this.current_token.type === TokenType.IDENTIFIER) {
            var_name_token = this.current_token;
            this.advance();

            // there must be a left parenthesis after the identifier
            if (this.current_token.type !== TokenType.LPAREN) {
                throw new InvalidSyntaxError(
                    this.current_token.pos_start, this.current_token.pos_end,
                    "Expected '('"
                );
            }
        } else {
            // anonymous function, no identifier
            // there must be a left parenthesis after anyway
            if (this.current_token.type !== TokenType.LPAREN) {
                throw new InvalidSyntaxError(
                    this.current_token.pos_start, this.current_token.pos_end,
                    "Expected identifier or '('"
                );
            }
        }

        this.advance();

        let is_optional = false; // once there is an optional argument, this goes to true
        // indeed, we cannot have a mandatory argument after an optional one.

        let arg_name_toks = []; // all the args
        let mandatory_arg_name_toks = []; // the mandatory args
        let optional_name_toks = []; // the optional args
        let default_values_nodes = []; // the tokens for the default value

        if (this.current_token.type === TokenType.IDENTIFIER) {
            // there is an identifier
            // advance
            // check if there is a question mark
            // if there is a question mark, check if there is an equal sign
            // if there is an equal sign, advance and get the default value (an expr)

            const check_for_optional_args = () => {
                let identifier_token = this.current_token;
                arg_name_toks.push(identifier_token);
                this.advance();

                // there might be a question mark
                // optional

                if (this.current_token.type === TokenType.QMARK) {
                    is_optional = true;
                    let question_mark_token = this.current_token;
                    optional_name_toks.push(identifier_token);
                    this.advance();

                    // there might be an equal sign
                    // to customise the default value
                    // which is null by default
                    if (this.current_token.type === TokenType.EQUALS) {
                        this.advance();

                        try {
                            let node_default_value = this.expr();
                            default_values_nodes.push(node_default_value);
                        } catch(e) {
                            throw new InvalidSyntaxError(
                                this.current_token.pos_start, this.current_token.pos_end,
                                "Expected default value for the argument."
                            );
                        }
                    } else {
                        let df = new NumberNode(new Token(TokenType.NUMBER, NumberValue.none.value, question_mark_token.pos_start, question_mark_token.pos_end));
                        default_values_nodes.push(df);
                    }
                } else { // mandatory with no default value
                    // there was an optional argument already
                    // so there is a mandatory argument after an optional one
                    // that's not good
                    if (is_optional) {
                        throw new InvalidSyntaxError(
                            identifier_token.pos_start, identifier_token.pos_end,
                            "Expected an optional argument"
                        );
                    } else {
                        mandatory_arg_name_toks.push(identifier_token);
                    }
                }
            };

            check_for_optional_args();

            // there are arguments, how many?
            // we want them all

            while (this.current_token.type === TokenType.COMMA) {
                this.advance();

                // there must be an identifier after the comma (= the arg)
                if (this.current_token.type !== TokenType.IDENTIFIER) {
                    throw new InvalidSyntaxError(
                        this.current_token.pos_start, this.current_token.pos_end,
                        "Expected identifier"
                    );
                }

                check_for_optional_args();
            }

            // we have all the args,
            // now there must be a right parenthesis

            if (this.current_token.type !== TokenType.RPAREN) {
                throw new InvalidSyntaxError(
                    this.current_token.pos_start, this.current_token.pos_end,
                    "Expected ',' or ')'"
                );
            }
        } else {
            // there is no identifier (no args)
            // so we must find a right parenthesis
            if (this.current_token.type !== TokenType.RPAREN) {
                throw new InvalidSyntaxError(
                    this.current_token.pos_start, this.current_token.pos_end,
                    "Expected identifier or ')'"
                );
            }
        }

        // we get out of the parenthesis

        this.advance();

        // we should have an arrow now
        // if we have an inline function of course
        if (this.current_token.type === TokenType.ARROW) {
            // great, enter the body now
            this.advance();

            // what's our body?
            let node_to_return = this.expr();

            return new FuncDefNode(
                var_name_token, // the name
                arg_name_toks, // all the arguments
                mandatory_arg_name_toks, // the mandatory arguments
                optional_name_toks, // the optional arguments
                default_values_nodes, // their default values
                node_to_return, // the body,
                true // should auto return? True because the arrow behaves like the `return` keyword.
            );
        }
        
        //
        //
        // Multiline function
        //
        // 

        // I want to write a colon when there are several lines
        if (this.current_token.type !== TokenType.COLON) {
            throw new InvalidSyntaxError(
                this.current_token.pos_start, this.current_token.pos_end,
                "Expected ':' or '->'"
            );
        }

        this.advance();

        // now there might be a new line

        let body = this.statements();

        if (!this.current_token.matches(TokenType.KEYWORD, "end")) {
            throw new InvalidSyntaxError(
                this.current_token.pos_start, this.current_token.pos_end,
                "Expected 'end'"
            );
        }

        this.advance();

        return new FuncDefNode(
            var_name_token,
            arg_name_toks,
            mandatory_arg_name_toks,
            optional_name_toks,
            default_values_nodes,
            body,
            false // should auto return? False because we need a `return` keyword for a several-lines function 
        );
    }
}