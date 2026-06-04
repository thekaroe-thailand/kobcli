import chalk from 'chalk';

export class ApiError extends Error {
    public statusCode?: number;
    public success: boolean = false;

    constructor(message: string, statusCode?: number) {
        super(message);
        this.name = 'ApiError';
        this.statusCode = statusCode;
    }
}

export function handleApiError(error: unknown): never {
    if (error instanceof ApiError) {
        console.error(chalk.red(`\n❌ API Error: ${error.message}`));

        if (error.statusCode === 401) {
            console.error(chalk.yellow('\nAuthentication failed. Please check your API credentials.'));
            console.error(chalk.yellow('Make sure KOB_API_KEY and KOB_API_TOKEN are correct.'));
        } else if (error.statusCode === 402) {
            console.error(chalk.yellow('\nInsufficient credits. Please top up your account.'));
        } else if (error.statusCode === 404) {
            console.error(chalk.yellow('\nResource not found.'));
        } else if (error.statusCode && error.statusCode >= 500) {
            console.error(chalk.yellow('\nServer error. Please try again later.'));
        }
    } else if (error instanceof Error) {
        console.error(chalk.red(`\n❌ Error: ${error.message}`));
    } else {
        console.error(chalk.red('\n❌ An unexpected error occurred'));
    }

    process.exit(1);
}

export function validateRequired(value: string | undefined, fieldName: string): string {
    if (!value || value.trim() === '') {
        console.error(chalk.red(`\n❌ Error: ${fieldName} is required`));
        process.exit(1);
    }
    return value;
}
