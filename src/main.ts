import * as core from '@actions/core'

import { getToken } from './api/authApi'
import {
  checkTaskStatus,
  getEnterpriseAppVersions,
  getProfileId,
  publishEnterpriseAppVersion,
  uploadEnterpriseApp,
  UploadServiceHeaders
} from './api/uploadApi'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const accessToken = core.getInput('accessToken')
    const appPath = core.getInput('appPath')
    const summary = core.getInput('summary')
    const releaseNotes = core.getInput('releaseNotes')
    const publishType = core.getInput('publishType') ?? '0'

    const loginResponse = await getToken(accessToken)
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
