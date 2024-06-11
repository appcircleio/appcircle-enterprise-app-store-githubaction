import * as core from '@actions/core'
import { execSync } from 'child_process'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    execSync(`npm install -g @appcircle/cli`, { stdio: 'inherit' })
    const accessToken = core.getInput('accessToken')
    const entProfileId = core.getInput('entProfileId')
    const appPath = core.getInput('appPath')
    const summary = core.getInput('summary')
    const releaseNotes = core.getInput('releaseNotes')
    const publishType = core.getInput('publishType') ?? '0'

    execSync(`appcircle login --pat=${accessToken}`, { stdio: 'inherit' })
    const command = `appcircle enterprise-app-store version upload-for-profile --entProfileId ${entProfileId} --app ${appPath} -o json`
    const output = execSync(command, { encoding: 'utf-8' })
    const list = JSON.parse(output)
    console.log('list:', list)
    console.log('taskID:', list?.taskId)
    await checkTaskStatus(list?.taskId)

    const versionCommand = `appcircle enterprise-app-store version list --entProfileId ${entProfileId}  -o json`

    const versions = execSync(versionCommand, { encoding: 'utf-8' })
    const latestPublishedAppId = JSON.parse(versions)?.[0]?.id
    console.log('latestPublishedAppId:', latestPublishedAppId)

    execSync(
      `appcircle enterprise-app-store version publish --entProfileId ${entProfileId} --entVersionId ${latestPublishedAppId} --summary "${summary}" --releaseNotes "${releaseNotes}" --publishType ${publishType}`,
      { encoding: 'utf-8' }
    )
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

async function checkTaskStatus(taskId: string, currentAttempt = 0) {
  const tokenCommand = `appcircle config get AC_ACCESS_TOKEN -o json`
  const output = execSync(tokenCommand, { encoding: 'utf-8' })
  console.log('typeof OUTPUT:', typeof output)
  console.log('OUTPUT:', output)
  const apiAccessToken = JSON.parse(output)?.AC_ACCESS_TOKEN

  const response = await fetch(
    `https://api.appcircle.io/task/v1/tasks/${taskId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiAccessToken}`
      }
    }
  )

  const res = await response.json()
  console.log('stateValue:', res?.stateValue)

  if (res?.stateValue == 1 && currentAttempt < 100) {
    return checkTaskStatus(taskId, currentAttempt + 1)
  }
}
