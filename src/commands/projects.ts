import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { KobApiClient } from '../utils/api.js';
import { getConfig } from '../utils/config.js';
import { handleApiError, validateRequired } from '../utils/errors.js';
import { formatProjects } from '../utils/format.js';
import type { ProjectsResponse, Project } from '../types/index.js';

export const projectsCommand = new Command('projects')
    .description('Manage your projects');

// List projects
projectsCommand
    .command('list')
    .description('List all your projects')
    .action(async () => {
        const spinner = ora('Fetching projects...').start();

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            const data = await client.get<ProjectsResponse>('/api/projects');

            spinner.succeed(`Found ${data.projects?.length || 0} projects`);

            if (data.projects && data.projects.length > 0) {
                console.log(formatProjects(data.projects));
            } else {
                console.log(chalk.yellow('\nNo projects found. Create one with: kob projects:create "Project Name"'));
            }
            console.log('');
        } catch (error) {
            spinner.fail('Failed to fetch projects');
            handleApiError(error);
        }
    });

// Create project
projectsCommand
    .command('create')
    .description('Create a new project')
    .argument('<name>', 'Project name')
    .option('-d, --description <description>', 'Project description')
    .action(async (name, opts) => {
        const spinner = ora('Creating project...').start();

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            validateRequired(name, 'Project name');

            const data = await client.post<ProjectsResponse>('/api/projects', {
                project_name: name,
                description: opts.description || '',
            });

            spinner.succeed('Project created successfully!');

            console.log(chalk.bold.cyan('\n📁 Project Created:'));
            console.log(chalk.dim('─'.repeat(60)));
            console.log(`Name: ${chalk.bold(data.project?.project_name)}`);
            console.log(`ID: ${chalk.cyan(data.project?.id)}`);
            if (data.project?.description) {
                console.log(`Description: ${data.project.description}`);
            }
            console.log(`Created: ${chalk.bold(new Date(data.project?.created_at || '').toLocaleString())}`);
            console.log('');
        } catch (error) {
            spinner.fail('Failed to create project');
            handleApiError(error);
        }
    });

// Update project
projectsCommand
    .command('update')
    .description('Update an existing project')
    .argument('<projectId>', 'Project ID')
    .option('-n, --name <name>', 'New project name')
    .option('-d, --description <description>', 'New description')
    .action(async (projectId, opts) => {
        const spinner = ora('Updating project...').start();

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            validateRequired(projectId, 'Project ID');

            const updates: any = { project_id: projectId };
            if (opts.name) updates.project_name = opts.name;
            if (opts.description) updates.description = opts.description;

            if (!opts.name && !opts.description) {
                console.error(chalk.yellow('\n⚠️  Please provide at least --name or --description'));
                process.exit(1);
            }

            const data = await client.patch<ProjectsResponse>('/api/projects', updates);

            spinner.succeed('Project updated successfully!');

            console.log(chalk.bold.cyan('\n📁 Project Updated:'));
            console.log(chalk.dim('─'.repeat(60)));
            console.log(`Name: ${chalk.bold(data.project?.project_name)}`);
            console.log(`ID: ${chalk.cyan(data.project?.id)}`);
            if (data.project?.description) {
                console.log(`Description: ${data.project.description}`);
            }
            console.log(`Updated: ${chalk.bold(new Date(data.project?.updated_at || '').toLocaleString())}`);
            console.log('');
        } catch (error) {
            spinner.fail('Failed to update project');
            handleApiError(error);
        }
    });

// Delete project
projectsCommand
    .command('delete')
    .description('Delete a project')
    .argument('<projectId>', 'Project ID')
    .action(async (projectId) => {
        const spinner = ora('Deleting project...').start();

        try {
            const config = getConfig();
            const client = new KobApiClient(config);

            validateRequired(projectId, 'Project ID');

            await client.delete<ProjectsResponse>('/api/projects', {
                project_id: projectId,
            });

            spinner.succeed('Project deleted successfully!');
            console.log(chalk.green('\n✓ Project has been deleted\n'));
        } catch (error) {
            spinner.fail('Failed to delete project');
            handleApiError(error);
        }
    });
