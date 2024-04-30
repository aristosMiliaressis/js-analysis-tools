const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const t = require("@babel/types");
const generate = require("@babel/generator").default;
const beautify = require("js-beautify");
const { readFileSync, writeFile } = require("fs");

function deobfuscate(filename, source) {
    
    // turns "void 0" into "undefined"
    const deobfuscateVoidToUndefinedVisitor = {
        UnaryExpression(path) { 
            const operator = path.get("operator").node;
            if (operator == "void") {
                let undefinedIdentifier = t.identifier('undefined')
            
                path.replaceWith(undefinedIdentifier);
            }         
        }
    };
    
    // turns "!0" and "!1" into "true" & "false"
    const deobfuscateMinifiedBoolVisitor = {
        UnaryExpression(path) {           
            const operator = path.get("operator").node;
            const argument = path.get("argument").node;
            if (operator == "!" && typeof argument.value == "number") {
                let boolLiteral = t.booleanLiteral(argument.value == 0)
            
                path.replaceWith(boolLiteral);
            }        
        }
    };
    
    // turns "-1 == x.toString()" into "x.toString() == -1"
    const swapLiteralsInBinaryExpressions = {
        BinaryExpression(path) {
            const operator = path.get("operator").node;
            if (operator == "==" || operator == "===" || operator == "!=" || operator == "!==") {
                const left = path.get("left");
                const right = path.get("right");
                if (t.isLiteral(left.node) && !t.isLiteral(right.node)) {
                    temp = left.node;
                    left.replaceWith(right.node);
                    right.replaceWith(temp);
                }
            }
        },
    };
    
    // Visitor for replacing hex/octal/binary numeric literals with decimal
    const deobfuscateEncodedNumeralsVisitor = {
        NumericLiteral(path) {
            if (path.node.extra) delete path.node.extra;
        },
    };
    
    // TODO swap undefined & identifier in Binary Expression
    // TODO swap !![] to false and ![] to true
    
    /// ^^^ everythig above is my experiments
    /// vvv everything bellow is part of the original blog series
    
    // Visitor for removing string encoding.
    const deobfuscateEncodedStringVisitor = {
        StringLiteral(path) {
            if (path.node.extra) delete path.node.extra;
        },
    };
    
    const deobfuscateStringConcatVisitor = {
        BinaryExpression(path) {
          let { confident, value } = path.evaluate(); // Evaluate the binary expression
          if (!confident) return; // Skip if not confident
          if (typeof value == "string") {
            path.replaceWith(t.stringLiteral(value)); // Substitute the simplified value
          }
        },
    };
       
    // Visitor for constant folding
    const foldConstantsVisitor = {
        BinaryExpression(path) {
            const left = path.get("left");
            const right = path.get("right");
            const operator = path.get("operator").node;

            if (t.isStringLiteral(left.node) && t.isStringLiteral(right.node)) {
                // In this case, we can use the old algorithm
                // Evaluate the binary expression
                let { confident, value } = path.evaluate();
                // Skip if not confident
                if (!confident) return;
                // Create a new node, infer the type
                let actualVal = t.valueToNode(value);
                // Skip if not a Literal type (e.g. StringLiteral, NumericLiteral, Boolean Literal etc.)
                if (!t.isStringLiteral(actualVal)) return;
                // Replace the BinaryExpression with the simplified value
                path.replaceWith(actualVal);
            } else {
                // Check if the right side is a StringLiteral. If it isn't, skip this node by returning.
                if (!t.isStringLiteral(right.node)) return;
                //Check if the right sideis a StringLiteral. If it isn't, skip this node by returning.
                if (!t.isStringLiteral(left.node.right)) return;
                // Check if the operator is addition (+). If it isn't, skip this node by returning.
                if (operator !== "+") return;

                // If all conditions are fine:

                // Evaluate the _right-most edge of the left-side_ + the right side;
                let concatResult = t.StringLiteral(
                    left.node.right.value + right.node.value
                );
                // Replace the _right-most edge of the left-side_ with `concatResult`.
                left.get("right").replaceWith(concatResult);
                //Remove the original right side of the expression as it is now a duplicate.
                right.remove();
            }
        },
    };
    
    // Visitor for deleting empty statements
    const deleteEmptyStatementsVisitor = {
        EmptyStatement(path) {
            path.remove();
        }
    };
    
    // Visitor for simplifying if statements and logical statements
    const simplifyIfAndLogicalVisitor = {
        "ConditionalExpression|IfStatement"(path) {
            let { consequent, alternate } = path.node;
            let testPath = path.get("test");
            const value = testPath.evaluateTruthy();
            if (value === true) {
                if (t.isBlockStatement(consequent)) {
                    consequent = consequent.body;
                }
                path.replaceWithMultiple(consequent);
            } else if (value === false) {
                if (alternate != null) {
                    if (t.isBlockStatement(alternate)) {
                        alternate = alternate.body;
                    }
                    path.replaceWithMultiple(alternate);
                } else {
                    path.remove();
                }
            }
        }
    };
    
    const ast = parser.parse(source);
    
    traverse(ast, swapLiteralsInBinaryExpressions);
    traverse(ast, deobfuscateMinifiedBoolVisitor);
    traverse(ast, deobfuscateVoidToUndefinedVisitor);
    traverse(ast, deobfuscateEncodedNumeralsVisitor);
    traverse(ast, deobfuscateEncodedStringVisitor);
    traverse(ast, foldConstantsVisitor);
    traverse(ast, simplifyIfAndLogicalVisitor);
    traverse(ast, deleteEmptyStatementsVisitor);
    traverse(ast, deobfuscateStringConcatVisitor);

    let deobfCode = generate(ast, { comments: false }).code;
    
    deobfCode = beautify(deobfCode, {
        indent_size: 4,
        space_in_empty_paren: true,
        break_chained_methods: true
    });
    
    writeCodeToFile(filename, deobfCode);
}

function writeCodeToFile(filename, code) {
    writeFile(filename, code, err => {
        if (err) {
            console.log("Error writing file", err);
        } else {
            console.log(`Wrote file to ${filename}`);
        }
    });
}
process.argv.forEach(function(val, index, array) {
    if (index < 2) return;
    deobfuscate(val, readFileSync(val, "utf8"));
});