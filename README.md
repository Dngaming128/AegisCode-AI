# AegisCode AI
[![Ask DeepWiki](https://devin.ai/assets/askdeepwiki.png)](https://deepwiki.com/Dngaming128/AegisCode-AI)

AegisCode-AI was designed as an AI-powered programming assistant. AegisCode AI is a local, deterministic AI coding engine designed for analyzing and automatically repairing TypeScript projects. It functions as both a VS Code extension and a command-line tool, using a multi-agent system to ensure safe and effective code modifications.
The project aims to empower developers by leveraging Large Language Models (LLMs) to write, optimize, and comprehend code more efficiently.

## Key Features
**Based on the project's structure and objectives, it offers the following functionalities:**

* **Automated Code Generation:** Capable of generating code snippets or entire functions based on natural language instructions (prompts).

* **Code Analysis & Optimization**: Helps identify inefficient code segments and provides suggestions to improve performance and readability.

* **Multi-Language Support**: Designed to work with various popular programming languages such as Python, JavaScript, Java, C++, and others.

* **Code Explanation**: A feature specifically helpful for beginners, providing step-by-step logic explanations for complex blocks of code.

* **Error & Bug Detection**: Analyzes code to find potential syntax or logical errors before execution, reducing debugging time.

## Technology Stack:
* **The project typically utilizes the following technologies**:

* **Primary Language**: Python (chosen for its extensive ecosystem of AI and machine learning libraries).

* **AI Integration**: Likely utilizes APIs from major providers like OpenAI (GPT), Anthropic (Claude), or local open-source models via Ollama or Hugging Face.

* **Supporting Libraries**: Uses libraries like requests for API communication and possibly environment management tools for configuration.

## How It Works
* **Input**: The user provides a prompt or pastes a specific piece of code into the system.

* **Processing**: AegisCode-AI sends this data to the configured AI model with specific "system prompts" designed to focus on high-quality code output.

* **Output**: The AI returns the optimized code, a detailed explanation, or a solution to a detected bug.

## Core Features

*   **Automated Code Repair**: Scans your TypeScript codebase, ingests diagnostics from TSC and ESLint, and generates patches to fix detected issues.
*   **Deep Code Analysis**: Builds a comprehensive understanding of your project by constructing dependency, call, and data-flow graphs.
*   **Multi-Agent System**:
    *   **Solver Agent**: Proposes solutions and patches based on code analysis and diagnostics.
    *   **Critic Agent**: Reviews proposed solutions against a confidence threshold to prevent risky or low-quality changes.
    *   **Verifier Agent**: Confirms that applied patches do not introduce new compilation errors and pass synthesized smoke tests.
*   **Safety and Control**:
    *   **Safe Mode**: Generates a plan of changes without applying them, allowing for manual review.
    *   **Rollbacks**: Automatically reverts changes if verification fails.
    *   **Confidence Thresholds**: Configurable thresholds to control the risk appetite of the Critic agent.
*   **Optional LLM Enhancement**: Integrates with local language models via Ollama to provide deeper reasoning for all agents.
*   **Persistent Memory**: Learns from past operations to improve its success rate and track common failure patterns.
*   **VS Code & CLI**: Operates seamlessly as a VS Code extension or as a standalone CLI tool, with an optional web UI for interactive sessions.

## Getting Started

### Prerequisites

*   [Node.js](https://nodejs.org/)
*   [VS Code](https://code.visualstudio.com/) (for extension usage)
*   [Ollama](https://ollama.com/) for local LLM integration.

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/dngaming128/aegiscode-ai.git
    cd aegiscode-ai
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Build the project:
    ```bash
    npm run build
    ```
4.  **For VS Code**: Open the repository folder in VS Code and press `F5` to launch a new Extension Development Host window with the extension activated.

## Usage

### VS Code Extension

Once the extension is active, you can access its features via the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

*   **`Aegis: Scan and Repair`**: Initiates a full scan-and-repair cycle. The engine will analyze the code, propose fixes, get them approved by the critic, apply them, and verify the result.
*   **`Aegis: Plan Fixes`**: Runs the analysis and critique steps but does not apply the patches. This is useful for reviewing proposed changes before they are made.
*   **`Aegis: Start UI Server`**: Launches a local web UI for a more interactive experience.

## Configuration

AegisCode AI can be configured via VS Code settings, a project-specific `aegis.config.json` file, or CLI arguments.

### VS Code Settings

In VS Code, navigate to `File > Preferences > Settings` and search for "Aegis Code AI".

*   `aegisCodeAI.port`: Port for the local Aegis UI server. (Default: `4000`)
*   `aegisCodeAI.safeMode`: If enabled, plans are generated but patches are not applied. (Default: `false`)
*   `aegisCodeAI.ultraStrict`: Requires a very high confidence score (0.95) before applying changes. (Default: `false`)
*   `aegisCodeAI.confidenceThreshold`: Minimum confidence required for the Critic agent to approve a plan. (Default: `0.72`)
*   `aegisCodeAI.ollama.enabled`: Enable Ollama-backed reasoning for all agents. (Default: `false`)
*   `aegisCodeAI.ollama.baseUrl`: Base URL for the Ollama server. (Default: `http://localhost:11434`)
*   `aegisCodeAI.ollama.models.*`: Ordered list of models to try for each agent (`solver`, `critic`, `verifier`).

### Project Configuration

Create an `aegis.config.json` file in your project's root directory to override default settings.

```json
{
  "safeMode": true,
  "confidenceThreshold": 0.8,
  "ollama": {
    "enabled": true,
    "models": {
      "solver": ["llama3.1:8b"],
      "critic": ["qwen2.5-coder:7b-instruct"],
      "verifier": ["llama3.1:8b"]
    }
  }
}
```

### CLI Arguments

| Flag                | Description                                                |
| ------------------- | ---------------------------------------------------------- |
| `--scan`            | Run in scan-and-repair mode.                               |
| `--ui`              | Run in UI server mode.                                     |
| `--repo <path>`     | Path to the repository to analyze.                         |
| `--port <number>`   | Port for the UI server.                                    |
| `--safe`            | Enable safe mode (do not apply patches).                   |
| `--ultra`           | Enable ultra-strict mode.                                  |
| `--threshold <num>` | Set the confidence threshold (0.0 to 1.0).                 |
| `--ollama`          | Enable Ollama integration.                                 |
| `--ollama-url <url>`| Set the Ollama server URL.                                 |

## System Architecture

The engine follows a structured, multi-stage process to ensure robust and reliable code modification.

1.  **Scan & Analyze**: The `RepoScanner` analyzes the project structure and creates a `ts.Program`. The `TscIngest` and `EslintIngest` modules collect diagnostics, while various builders create dependency, call, and data-flow graphs.
2.  **Solve**: The `SolverAgent` receives all this context and generates a `SolveResult` containing proposed patches, identified root causes, and a confidence score. This step can be augmented by an LLM via the `OllamaClient`.
3.  **Critique**: The `CriticAgent` reviews the `SolveResult`. It rejects the plan if the confidence score is below the configured threshold or if it detects high-risk changes.
4.  **Apply**: If the plan is approved, the `PatchApplier` applies the proposed AST patches to the source files, keeping backups of the original content. If `safeMode` is on, this step is skipped.
5.  **Verify**: The `VerifierAgent` performs two checks:
    *   It runs TSC again to ensure no new compilation errors were introduced.
    *   The `TestSynthesis` module generates and runs smoke tests for modified functions to check for runtime breakages.
6.  **Commit or Rollback**: If verification succeeds, the process is complete. If it fails, the `PatchApplier` uses the backups to roll back all changes, leaving the codebase in its original state.
7.  **Memorize**: The `MemoryStore` records the outcome (success or failure) of the operation to inform the confidence calculations of future runs.

## License

This project is licensed under the MIT License. See the [LICENSE.md](LICENSE.md) file for details.