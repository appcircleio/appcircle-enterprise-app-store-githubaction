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
