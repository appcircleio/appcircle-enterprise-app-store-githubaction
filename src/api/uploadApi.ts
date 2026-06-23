import axios, { AxiosRequestConfig } from 'axios'
import fs from 'fs'
import FormData from 'form-data'
import path from 'path'

let apiHostname = 'https://api.appcircle.io'
export const appcircleApi = axios.create({
  baseURL: `${apiHostname}/`
})

export function setApiEndpoint(endpoint: string): void {
  if (!endpoint) return
  apiHostname = endpoint.replace(/\/+$/, '')
  appcircleApi.defaults.baseURL = `${apiHostname}/`
}

async function uploadWithRetry(
  doUpload: () => Promise<any>,
  maxRetries = 5
): Promise<any> {
  let attempt = 0
  let delay = 1000
  while (true) {
    try {
      return await doUpload()
    } catch (error: any) {
      const status = error?.response?.status
      const retryable =
        status === 503 ||
        error?.code === 'ECONNRESET' ||
        (typeof error?.message === 'string' &&
          error.message.includes('socket hang up'))
      if (!retryable || attempt >= maxRetries) {
        throw error
      }
      attempt++
      const jitter = Math.floor(Math.random() * 300)
      await new Promise(resolve => setTimeout(resolve, delay + jitter))
      delay *= 2
    }
  }
}

export class UploadServiceHeaders {
  static token = ''

  static getHeaders = (): AxiosRequestConfig['headers'] => {
    let response: AxiosRequestConfig['headers'] = {
      accept: 'application/json',
      'User-Agent': 'Appcircle Github Action'
    }

    response.Authorization = `Bearer ${UploadServiceHeaders.token}`

    return response
  }
}

export async function getEnterpriseAppVersions(options: {
  entProfileId: string
  publishType?: string
}) {
  let versionType = ''
  switch (options?.publishType) {
    case '1':
      versionType = '?publishtype=Beta'
      break
    case '2':
      versionType = '?publishtype=Live'
    default:
      break
  }

  const profileResponse = await appcircleApi.get(
    `store/v2/profiles/${options.entProfileId}/app-versions${versionType}`,
    {
      headers: UploadServiceHeaders.getHeaders()
    }
  )
  return profileResponse.data
}

export async function getEnterpriseProfiles() {
  const buildProfiles = await appcircleApi.get(`store/v2/profiles`, {
    headers: UploadServiceHeaders.getHeaders()
  })
  return buildProfiles.data
}

export async function uploadEnterpriseApp(app: string) {
  const filePath = app
  const fileName = path.basename(filePath)
  const fileSize = fs.statSync(filePath).size

  // Step 1: Get upload information (size-validated, returns the upload method)
  console.log('Getting file upload information...')
  const uploadInfoResponse = await appcircleApi.get<{
    fileId: string
    uploadUrl: string
    configuration?: {
      httpMethod: string
      signParameters: Record<string, string>
    }
  }>(`store/v1/profiles/app-versions`, {
    params: { action: 'uploadInformation', fileName, fileSize },
    headers: UploadServiceHeaders.getHeaders()
  })
  const { fileId, uploadUrl, configuration } = uploadInfoResponse.data
  const httpMethod = configuration?.httpMethod?.toUpperCase() ?? 'PUT'
  const signParameters = configuration?.signParameters ?? {}

  // Step 2: Upload the binary to object storage (PUT, or POST multipart for MinIO)
  console.log('Uploading file to Appcircle...')
  await uploadWithRetry(() => {
    if (httpMethod === 'POST') {
      const form = new FormData()
      for (const [key, value] of Object.entries(signParameters)) {
        form.append(key, value)
      }
      form.append('file', fs.createReadStream(filePath), fileName)
      return axios.post(uploadUrl, form, {
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { ...form.getHeaders() }
      })
    }
    return axios.put(uploadUrl, fs.readFileSync(filePath), {
      headers: { 'Content-Type': 'application/octet-stream' },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })
  })

  // Step 3: Commit. createNewProfile=true lets the server route the binary to its
  // profile by package (matching an existing one, or creating it if none exists).
  console.log('Committing file upload...')
  const commitResponse = await appcircleApi.post<{ taskId: string }>(
    `store/v1/profiles/app-versions`,
    { fileId, fileName },
    {
      params: { action: 'commitFileUpload', createNewProfile: true },
      headers: UploadServiceHeaders.getHeaders()
    }
  )
  return commitResponse.data
}

export async function publishEnterpriseAppVersion(options: {
  entProfileId: string
  entVersionId: string
  summary: string
  releaseNotes: string
  publishType: string
}) {
  const versionResponse = await appcircleApi.patch(
    `store/v2/profiles/${options.entProfileId}/app-versions/${options.entVersionId}?action=publish`,
    {
      summary: options.summary,
      releaseNotes: options.releaseNotes,
      publishType: options.publishType
    },
    {
      headers: UploadServiceHeaders.getHeaders()
    }
  )
  return versionResponse.data
}

export async function getProfileId() {
  const profiles = await getEnterpriseProfiles().then(res =>
    res.sort((a: any, b: any) => {
      return (
        new Date(b.lastBinaryReceivedDate).getTime() -
        new Date(a.lastBinaryReceivedDate).getTime()
      )
    })
  )

  return profiles[0].id
}

export async function checkTaskStatus(taskId: string, currentAttempt = 0) {
  const response = await appcircleApi.get(`/task/v1/tasks/${taskId}`, {
    headers: UploadServiceHeaders.getHeaders()
  })

  if (response?.data.stateValue == 1 && currentAttempt < 100) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    return checkTaskStatus(taskId, currentAttempt + 1)
  }

  if (response.data.stateValue === 2) {
    return false
  }

  return true
}
