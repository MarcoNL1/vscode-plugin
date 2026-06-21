import 'mocha';
import * as assert from 'assert';
import { performance } from 'perf_hooks';
import * as vscode from 'vscode';
import { FrankValidator } from '../validation/frank-validator';
import { ConfigurationIndex } from '../validation/configuration-index';

/**
 * Performance test for NFR-1: validation must stay responsive on large
 * configurations. The requirement states that validation should complete
 * well within the 500 ms budget that keeps typing fluid. This test measures
 * the pure FrankValidator.validate() time (it deliberately excludes the
 * 300 ms debounce, which is an intentional wait, not processing time).
 */
suite('FrankValidator Performance Test Suite', () => {

    // NFR-1 budget in milliseconds.
    const MAX_AVERAGE_MS = 500;

    // Mock document that exposes the same surface the validator relies on.
    function createMockDocument(content: string): vscode.TextDocument {
        const lines = content.split('\n');
        return {
            languageId: 'xml',
            getText: () => content,
            lineAt: (n: number) => ({ text: lines[n] }),
            lineCount: lines.length,
            uri: vscode.Uri.parse('untitled:performance.xml'),
        } as unknown as vscode.TextDocument;
    }

    function createMockCollection(): vscode.DiagnosticCollection {
        return {
            set: () => {},
            delete: () => {},
        } as unknown as vscode.DiagnosticCollection;
    }

    function createMockIndex(knownListeners: string[] = []): ConfigurationIndex {
        return { hasJavaListener: (name: string) => knownListeners.includes(name) } as unknown as ConfigurationIndex;
    }

    /**
     * Builds a large but valid Frank configuration. Every pipe forwards to the
     * next pipe in its pipeline, and the last pipe forwards to the shared Exit,
     * so all references resolve and the validator does its full work without
     * being dominated by error reporting.
     */
    function buildLargeConfiguration(adapterCount: number, pipesPerAdapter: number): string {
        const lines: string[] = ['<Configuration>'];

        for (let a = 0; a < adapterCount; a++) {
            lines.push(`    <Adapter name="Adapter${a}">`);
            lines.push(`        <Receiver name="Receiver${a}">`);
            lines.push(`            <JavaListener name="Listener${a}" serviceName="service${a}" />`);
            lines.push('        </Receiver>');
            lines.push(`        <Pipeline firstPipe="Adapter${a}_Pipe0">`);

            for (let p = 0; p < pipesPerAdapter; p++) {
                const isLast = p === pipesPerAdapter - 1;
                const target = isLast ? 'EXIT' : `Adapter${a}_Pipe${p + 1}`;
                lines.push(`            <Pipe name="Adapter${a}_Pipe${p}" className="org.frankframework.pipes.EchoPipe">`);
                lines.push(`                <Forward name="success" path="${target}" />`);
                lines.push('            </Pipe>');
            }

            lines.push('            <Exit name="EXIT" state="SUCCESS" />');
            lines.push('        </Pipeline>');
            lines.push('    </Adapter>');
        }

        lines.push('</Configuration>');
        return lines.join('\n');
    }

    test('validate - large configuration stays within the NFR-1 budget', async function () {
        // Building and validating thousands of pipes takes longer than Mocha's
        // default 2 s timeout, so raise it for this measurement.
        this.timeout(60000);

        const adapterCount = 50;
        const pipesPerAdapter = 20; // 50 x 20 = 1000 pipes, a realistic worst case.
        const xml = buildLargeConfiguration(adapterCount, pipesPerAdapter);
        const document = createMockDocument(xml);

        const knownListeners = Array.from({ length: adapterCount }, (_, i) => `Listener${i}`);
        const validator = new FrankValidator(createMockCollection(), createMockIndex(knownListeners));

        const warmupRuns = 3;   // discard the first runs (JIT / cache warm-up).
        const measuredRuns = 10;

        for (let i = 0; i < warmupRuns; i++) {
            await validator.validate(document);
        }

        const timings: number[] = [];
        for (let i = 0; i < measuredRuns; i++) {
            const start = performance.now();
            await validator.validate(document);
            timings.push(performance.now() - start);
        }

        const total = timings.reduce((sum, t) => sum + t, 0);
        const average = total / measuredRuns;
        const min = Math.min(...timings);
        const max = Math.max(...timings);

        // Logged so the numbers can be captured (e.g. a screenshot) as evidence
        // for the test report under NFR-1.
        console.log(`[NFR-1] Configuration size: ${adapterCount * pipesPerAdapter} pipes, ${document.lineCount} lines`);
        console.log(`[NFR-1] Validation time over ${measuredRuns} runs - average: ${average.toFixed(1)} ms, min: ${min.toFixed(1)} ms, max: ${max.toFixed(1)} ms`);

        assert.ok(
            average < MAX_AVERAGE_MS,
            `Average validation time (${average.toFixed(1)} ms) should stay under the NFR-1 budget of ${MAX_AVERAGE_MS} ms`,
        );
    });
});
