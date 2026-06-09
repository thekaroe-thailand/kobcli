import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface ProjectEntry {
    name: string;
    path: string;
    addedAt: string;
}

function projectsFile(): string {
    const dir = join(homedir(), '.kob-cli');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return join(dir, 'projects.json');
}

export function loadProjects(): ProjectEntry[] {
    try {
        const p = projectsFile();
        if (!existsSync(p)) return [];
        const data = JSON.parse(readFileSync(p, 'utf-8'));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

export function saveProjects(projects: ProjectEntry[]): void {
    try {
        writeFileSync(projectsFile(), JSON.stringify(projects, null, 2), 'utf-8');
    } catch { /* non-fatal */ }
}

export function addProject(name: string, projectPath: string): boolean {
    const projects = loadProjects();
    const existing = projects.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
    
    const entry: ProjectEntry = {
        name,
        path: projectPath,
        addedAt: new Date().toISOString()
    };
    
    if (existing !== -1) {
        projects[existing] = entry;
    } else {
        projects.push(entry);
    }
    
    // Sort alphabetically
    projects.sort((a, b) => a.name.localeCompare(b.name));
    saveProjects(projects);
    return true;
}

export function removeProject(name: string): boolean {
    const projects = loadProjects();
    const filtered = projects.filter(p => p.name.toLowerCase() !== name.toLowerCase());
    if (filtered.length === projects.length) return false;
    
    saveProjects(filtered);
    return true;
}
