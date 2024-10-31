import { watch } from 'chokidar';
import { glob } from 'glob';
import { resolve } from 'path';
import { loadConfig } from '../config/loader';
import type { ShortestConfig } from '../config/types';
import { Reporter } from './reporter';

export class TestRunner {
  private config!: ShortestConfig;
  private cwd: string;
  private reporter: Reporter;
  private exitOnSuccess: boolean;

  constructor(cwd: string, exitOnSuccess = true) {
    this.cwd = cwd;
    this.reporter = new Reporter();
    this.exitOnSuccess = exitOnSuccess;
  }

  async initialize() {
    this.config = await loadConfig(this.cwd);
  }

  private async findTestFiles(pattern?: string): Promise<string[]> {
    await this.initialize();
    
    const testDirs = Array.isArray(this.config.testDir) 
      ? this.config.testDir 
      : [this.config.testDir || 'tests'];

    const files = [];
    for (const dir of testDirs) {
      if (pattern) {
        const cleanPattern = pattern
          .replace(/\.ts$/, '')
          .replace(/\.test$/, '')
          .split('/')
          .pop();
        
        const globPattern = `${dir}/**/${cleanPattern}.test.ts`;
        
        console.log('Clean pattern:', cleanPattern);
        console.log('Full glob pattern:', globPattern);
        
        const matches = await glob(globPattern, { 
          cwd: this.cwd,
          absolute: true
        });
        
        console.log('Found matches:', matches);
        files.push(...matches);
      } else {
        const globPattern = `${dir}/**/*.test.ts`;
        const matches = await glob(globPattern, { cwd: this.cwd });
        files.push(...matches.map(f => resolve(this.cwd, f)));
      }
    }

    return files;
  }

  private async executeTest(file: string) {
    this.reporter.startFile(file);
    this.reporter.reportTest('Sample test');
  }

  async runFile(pattern: string) {
    const files = await this.findTestFiles(pattern);
    
    if (files.length === 0) {
      console.error(`No test files found matching: ${pattern}`);
      process.exit(1);
    }

    for (const file of files) {
      await this.executeTest(file);
    }
    
    this.reporter.summary();

    if (this.exitOnSuccess && this.reporter.allTestsPassed()) {
      process.exit(0);
    }

    this.watchMode(files);
  }

  async runAll() {
    await this.initialize();
    const files = await this.findTestFiles();
    
    for (const file of files) {
      await this.executeTest(file);
    }
    
    this.reporter.summary();

    if (this.exitOnSuccess && this.reporter.allTestsPassed()) {
      process.exit(0);
    }

    this.watchMode(files);
  }

  private watchMode(files: string[]) {
    this.reporter.watchMode();
    
    const watcher = watch(files, {
      ignoreInitial: true
    });

    watcher.on('change', async (file) => {
      this.reporter.fileChanged(file);
      await this.executeTest(file);
      this.reporter.summary();
    });
  }
}