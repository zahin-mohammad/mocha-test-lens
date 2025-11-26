#!/usr/bin/env node

/**
 * Script to prepare release by updating version and packaging extension
 * This runs before semantic-release publish step
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// Read package.json
const packagePath = path.join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'))

// Get next version from semantic-release dry-run
try {
    let output = ''
    let stderr = ''

    try {
        // Run semantic-release dry-run, capturing both stdout and stderr
        output = execSync('npx semantic-release --dry-run', {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
            env: {
                ...process.env,
                GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
            },
        })
    } catch (error) {
        // semantic-release exits with non-zero when no release is needed
        output = error.stdout?.toString() || ''
        stderr = error.stderr?.toString() || ''

        // Check if it's just "no release needed" vs an actual error
        const combinedOutput = output + stderr
        if (
            combinedOutput.includes('no release') ||
            combinedOutput.includes('No release') ||
            combinedOutput.includes('There are no relevant changes')
        ) {
            console.log('No release needed')
            process.exit(0)
        }
        // If it's a different error, re-throw it
        throw error
    }

    // Try multiple patterns to find the version
    const versionPatterns = [
        /next release version is (\d+\.\d+\.\d+)/i,
        /The next release version is (\d+\.\d+\.\d+)/i,
        /would release (\d+\.\d+\.\d+)/i,
        /release version (\d+\.\d+\.\d+)/i,
    ]

    let nextVersion = null
    for (const pattern of versionPatterns) {
        const match = output.match(pattern)
        if (match) {
            nextVersion = match[1]
            break
        }
    }

    if (!nextVersion) {
        console.log(
            'Could not determine next version from semantic-release output'
        )
        console.log('Output:', output)
        console.log('Stderr:', stderr)
        console.log('No release needed or unable to parse version')
        process.exit(0)
    }

    console.log(`Updating version to ${nextVersion}`)

    // Update package.json version
    packageJson.version = nextVersion
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 4) + '\n')

    // Package extension
    console.log('Packaging extension...')
    execSync('npx @vscode/vsce package --no-yarn', { stdio: 'inherit' })

    console.log('Release prepared successfully')
} catch (error) {
    console.error('Error preparing release:', error.message)
    // Check if it's a "no release needed" scenario
    const errorOutput =
        (error.stdout?.toString() || '') +
        (error.stderr?.toString() || '') +
        error.message
    if (
        errorOutput.includes('no release') ||
        errorOutput.includes('No release') ||
        errorOutput.includes('There are no relevant changes')
    ) {
        console.log('No release needed')
        process.exit(0)
    }
    // Re-throw actual errors
    process.exit(1)
}
