import axios, { AxiosRequestConfig } from 'axios'
import fs from 'fs'
import FormData from 'form-data'

const API_HOSTNAME = 'https://api.appcircle.io'
export const appcircleApi = axios.create({
  baseURL: API_HOSTNAME.endsWith('/') ? API_HOSTNAME : `${API_HOSTNAME}/`
})

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
  const buildProfiles = await appcircleApi.get(`store/v2/profiles?Sort=desc`, {
    headers: UploadServiceHeaders.getHeaders()
  })
  return buildProfiles.data
}

export async function uploadEnterpriseApp(app: string) {
  const data = new FormData()
  data.append('File', fs.createReadStream(app))
  const uploadResponse = await appcircleApi.post(
    `store/v2/profiles/app-versions`,
    data,
    {
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      headers: {
        ...UploadServiceHeaders.getHeaders(),
        ...data.getHeaders(),
        'Content-Type': 'multipart/form-data;boundary=' + data.getBoundary()
      }
    }
  )
  return uploadResponse.data
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

  console.log('profiles:', profiles)
}
