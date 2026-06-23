import * as core from '@actions/core'

import { getToken } from './api/authApi'
import {
  checkTaskStatus,
  getEnterpriseAppVersions,
  getProfileId,
  publishEnterpriseAppVersion,
  setApiEndpoint,
  uploadEnterpriseApp,
  UploadServiceHeaders
} from './api/uploadApi'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const personalAPIToken = core.getInput('personalAPIToken')
    const authEndpoint =
      core.getInput('authEndpoint') || 'https://auth.appcircle.io'
    const apiEndpoint =
      core.getInput('apiEndpoint') || 'https://api.appcircle.io'
    const appPath = core.getInput('appPath')
    const summary = core.getInput('summary')
    const releaseNotes = core.getInput('releaseNotes')
    const publishType = core.getInput('publishType') ?? '0'

    setApiEndpoint(apiEndpoint)

    const validExtensions = ['.apk', '.aab', '.ipa']
    const fileExtension = appPath.slice(appPath.lastIndexOf('.')).toLowerCase()
    if (!validExtensions.includes(fileExtension)) {
      core.setFailed(
        `Invalid file extension: ${appPath}. For Android, use .apk or .aab. For iOS, use .ipa.`
      )
      return
    }

    const loginResponse = await getToken(personalAPIToken, authEndpoint)
    UploadServiceHeaders.token = loginResponse.access_token
    console.log('Logged in to Appcircle successfully')

    const uploadResponse = await uploadEnterpriseApp(appPath)
    const status = await checkTaskStatus(uploadResponse.taskId)

    if (!status) {
      core.setFailed(
        `${uploadResponse.taskId} id upload request failed with status Cancelled`
      )
      return
    }

    if (publishType !== '0') {
      const profileId = await getProfileId()
      const appVersions = await getEnterpriseAppVersions({
        entProfileId: profileId
      })
      const entVersionId = appVersions[0].id
      await publishEnterpriseAppVersion({
        entProfileId: profileId,
        entVersionId: entVersionId,
        summary,
        releaseNotes,
        publishType
      })
    }

    console.log(
      `${appPath} uploaded to the Appcircle Enterprise Store successfully`
    )
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message)
    } else {
      core.setFailed(`An unexpected error occurred ${error}`)
    }
  }
}
