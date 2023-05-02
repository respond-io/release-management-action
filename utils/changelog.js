const { promises: fs } = require('fs');

class ChangeLog {
    static async generateChangeLogContent() {
        let currentChangelog = '';

        try {
            currentChangelog = await fs.readFile('./CHANGELOG.md', 'utf8');
        } catch (e) {}

        console.log(currentChangelog);
    }
}