import { useState } from "react";
import { Link } from "react-router-dom";

const BUTTONS = [
  "7", "8", "9", "÷",
  "4", "5", "6", "×",
  "1", "2", "3", "−",
  "0", ".", "=", "+",
];

export default function Calculator() {
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  };

  const clearAll = () => {
    setDisplay("0");
    setPrev(null);
    setOp(null);
    setWaitingForOperand(false);
  };

  const compute = (a, b, operator) => {
    switch (operator) {
      case "+": return a + b;
      case "−": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? NaN : a / b;
      default: return b;
    }
  };

  const performOp = (nextOp) => {
    const inputValue = parseFloat(display);
    if (prev == null) {
      setPrev(inputValue);
    } else if (op) {
      const result = compute(prev, inputValue, op);
      setDisplay(String(Number.isFinite(result) ? Math.round(result * 1e10) / 1e10 : "Error"));
      setPrev(Number.isFinite(result) ? result : null);
    }
    setWaitingForOperand(true);
    setOp(nextOp);
  };

  const handlePress = (btn) => {
    if (btn === "=") {
      performOp(null);
      setOp(null);
      return;
    }
    if (["+", "−", "×", "÷"].includes(btn)) {
      performOp(btn);
      return;
    }
    if (btn === ".") {
      inputDecimal();
      return;
    }
    inputDigit(btn);
  };

  return (
    <div>
      <Link to="/wallet" className="tree-remove-btn" style={{ display: "inline-block", marginBottom: 16, textDecoration: "none" }}>
        &lt; Back to Wallet
      </Link>

      <h1 className="page-title">Calculator</h1>

      <div className="calc-wrap">
        <div className="calc-display">{display}</div>
        <div className="calc-grid">
          <button className="calc-btn calc-btn-clear" onClick={clearAll}>C</button>
          {BUTTONS.map((b) => (
            <button
              key={b}
              className={"calc-btn" + (["÷", "×", "−", "+", "="].includes(b) ? " calc-btn-op" : "")}
              onClick={() => handlePress(b)}
            >
              {b}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
