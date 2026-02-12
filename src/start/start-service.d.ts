declare class StartService {
    context: any;
    constructor(context: any);
    ensureRanProjectsFileExists(): void;
    createFile(workspaceRoot: any, file: any): Promise<boolean>;
    getWorkingDirectory(file?: any): Promise<string>;
    getComposeFile(dir: any): string;
    deleteRanProject(method: any, workingDir: any): Promise<void>;
    saveRanProject(method: any, workingDir: any): Promise<void>;
    isFrameworkFile(file: any): boolean;
    toggleUpdate(workingDir: any): Promise<void>;
    getLocalFFVersions(workingDir: any): {
        file: string;
        version: string;
    }[];
    updateStrategySet(workingDir: any): boolean;
    ffVersionSet(workingDir: any): boolean;
    getSetFFVersion(workingDir: any): string;
    startWithAnt(workingDir: any, isCurrent: any): Promise<void>;
    startWithDocker(workingDir: any, isCurrent: any): Promise<void>;
    startWithDockerCompose(workingDir: any, isCurrent: any): Promise<void>;
}
export default StartService;
//# sourceMappingURL=start-service.d.ts.map