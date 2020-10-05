export interface BaseResponse {
  type: string
  response: number
  responseCode: number
  errorMessage?: string
}

export interface InitializeResponse extends BaseResponse {
  totalBytes: number
}

export interface RequestResponse extends BaseResponse {
  data?: string
}

export type ResponseType = BaseResponse | InitializeResponse | RequestResponse
