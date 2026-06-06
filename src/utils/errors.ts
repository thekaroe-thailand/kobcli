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

// SECURITY: Redact any API key/token that may have leaked into a user-facing
// error message. Server error bodies sometimes echo the credential that was
// rejected, and we MUST NOT print it to the terminal or logs.
//
// Implementation note: we iterate over the string with a sliding window and
// try each pattern at the current position. Once a redaction is applied, we
// jump past the redacted region so the next iteration cannot re-match inside
// it. This is more robust than a multi-pass `String.replace` because that
// approach can produce nested replacements (e.g. "kob_xxxx" matched by both
// the kob_ pattern AND the api_key=value pattern), and it avoids depending
// on regex engine support for lookbehind.

const REDACTION_RULES: Array<{
    // Test whether the substring starting at `i` looks like a secret
    test: (s: string, i: number) => { end: number; prefixLen: number } | null;
    label: string;
}> = [
    // KOB key: kob_<16+ alnum/dash/underscore chars>
    {
        label: 'kob_key',
        test: (s, i) => {
            if (s.slice(i, i + 4) !== 'kob_') return null;
            let end = i + 4;
            while (end < s.length && /[A-Za-z0-9_\-]/.test(s[end]!)) end++;
            if (end - i - 4 < 16) return null;
            return { end, prefixLen: 0 };
        },
    },
    // api_key=VALUE / api_token=VALUE / access_token=VALUE / apikey=VALUE
    {
        label: 'api_kv',
        test: (s, i) => {
            const keys = ['api_key', 'api_token', 'access_token', 'apikey'];
            let matchedKey = -1;
            for (const k of keys) {
                if (s.slice(i, i + k.length).toLowerCase() === k) {
                    matchedKey = k.length;
                    break;
                }
            }
            if (matchedKey === -1) return null;
            let j = i + matchedKey;
            // Optional whitespace, = or :, optional quote
            while (j < s.length && /[\s=:]/.test(s[j]!)) j++;
            if (j < s.length && (s[j] === '"' || s[j] === "'")) j++;
            const valueStart = j;
            while (j < s.length && /[A-Za-z0-9_\-]/.test(s[j]!)) j++;
            if (j - valueStart < 8) return null;
            return { end: j, prefixLen: valueStart - i };
        },
    },
    // "Bearer <token>" — preserve "Bearer " in the output
    {
        label: 'bearer',
        test: (s, i) => {
            if (s.slice(i, i + 7) !== 'Bearer ') return null;
            const valueStart = i + 7;
            let j = valueStart;
            while (j < s.length && /[A-Za-z0-9_\-\.]/.test(s[j]!)) j++;
            if (j - valueStart < 16) return null;
            return { end: j, prefixLen: 7 };
        },
    },
    // Bare hex token: 32+ hex chars bounded by non-word chars
    {
        label: 'hex_token',
        test: (s, i) => {
            // Must not be inside a word (so we don't re-match KOB key suffix)
            if (i > 0 && /[A-Za-z0-9_]/.test(s[i - 1]!)) return null;
            const start = i;
            let j = i;
            while (j < s.length && /[A-Fa-f0-9]/.test(s[j]!)) j++;
            if (j - start < 32) return null;
            // Must not be followed by more word chars (would indicate we
            // started in the middle of a longer identifier)
            if (j < s.length && /[A-Za-z0-9_]/.test(s[j]!)) return null;
            return { end: j, prefixLen: 0 };
        },
    },
];

export function redactSecret(input: string): string {
    if (!input) return input;
    let result = '';
    let i = 0;
    while (i < input.length) {
        let matched: { end: number; prefixLen: number } | null = null;
        for (const rule of REDACTION_RULES) {
            const m = rule.test(input, i);
            if (m) { matched = m; break; }
        }
        if (matched) {
            // Copy the prefix verbatim (e.g. "Bearer ", "api_key=")
            result += input.slice(i, i + matched.prefixLen);
            result += '[REDACTED]';
            i = matched.end;
        } else {
            result += input[i];
            i++;
        }
    }
    return result;
}

export function handleApiError(error: unknown): never {
    if (error instanceof ApiError) {
        const safeMessage = redactSecret(error.message);
        console.error(chalk.red(`\n❌ API Error: ${safeMessage}`));

        if (error.statusCode === 401) {
            console.error(chalk.yellow('\nAuthentication failed. Please check your API credentials.'));
            console.error(chalk.yellow('Make sure KOB_API_KEY is correct (format: kob_xxx:your_token).'));
        } else if (error.statusCode === 402) {
            console.error(chalk.yellow('\nInsufficient credits. Please top up your account.'));
        } else if (error.statusCode === 404) {
            console.error(chalk.yellow('\nResource not found.'));
        } else if (error.statusCode && error.statusCode >= 500) {
            console.error(chalk.yellow('\nServer error. Please try again later.'));
        }
    } else if (error instanceof Error) {
        const safeMessage = redactSecret(error.message);
        console.error(chalk.red(`\n❌ Error: ${safeMessage}`));
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
