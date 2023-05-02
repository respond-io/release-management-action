module.exports = `
## [{{version}}](https://github.com/{{org}}/{{repo}}/compare/{{previous_version}}...{{version}}) ({{date}})

{{#if features}}
### Features

{{#each features}}
* {{this.commit_name}} ([{{this.compact_commit_hash}}](https://github.com/{{org}}/{{repo}}/commit/{{this.commit_hash}}))
{{/each}}
{{/if}}

{{#if bug_fixes}}
### Bug Fixes

{{#each bug_fixes}}
* {{this.commit_name}} ([{{this.compact_commit_hash}}](https://github.com/{{org}}/{{repo}}/commit/{{this.commit_hash}}))
{{/each}}
{{/if}}

{{#if other_commits}}
### Bug Fixes

{{#each other_commits}}
* {{this.commit_name}} ([{{this.compact_commit_hash}}](https://github.com/{{org}}/{{repo}}/commit/{{this.commit_hash}}))
{{/each}}
{{/if}}

{{#if affected_areas}}
### Affected Areas
| **Service**        | **Type**                                         |
|--------------------|---------------------------------------------------------|
{{#each affected_areas}}
| \`{{entity}}\` | {{type}} |
{{/each}}
{{/if}}
`;