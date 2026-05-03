# LZW Compression Algorithm Visualizer

A high-performance web-based tool designed to visualize and benchmark the **Lempel–Ziv–Welch (LZW)** lossless data compression algorithm. This project demonstrates the implementation of dictionary-based greedy strategies and their empirical analysis.

## 🚀 Overview
LZW is a universal lossless data compression algorithm. This visualizer provides a step-by-step breakdown of how variable-length strings are mapped to fixed-length codes, making it an excellent resource for learning data structures and algorithmic efficiency.

## ✨ Key Features
- **Real-Time Visualization:** Interactive step-by-step dictionary building and pattern matching.
- **Complexity Analysis:** Built-in tools to calculate Big-O time and space complexity based on input entropy.
- **Dynamic Benchmarking:** Generates performance graphs for:
  - Execution Time vs. Input Size ($O(n)$ verification)
  - Dictionary Growth Patterns
  - Compression Ratio percentage
- **Automated Test Suite:** A comprehensive testing module to validate the algorithm against various data patterns (repetitive, random, and structured).

## 🛠 Tech Stack
- **Frontend:** HTML5, CSS3 (Modern Academic Theme)
- **Engine:** Vanilla JavaScript (ES6+)
- **Data Viz:** Custom SVG/Canvas-based graphing logic for performance metrics.

## 📈 Algorithmic Insights
- **Design Strategy:** Dictionary-based Greedy Approach.
- **Time Complexity:** - Best Case: $\Omega(n)$
  - Average Case: $\Theta(n)$
  - Worst Case: $O(n)$
- **Space Complexity:** $O(n)$ (Dynamic dictionary expansion).

## 💻 Installation & Usage
1. Clone the repository:
   ```bash
   git clone [https://github.com/yourusername/LZW-Visualizer.git](https://github.com/yourusername/LZW-Visualizer.git)
