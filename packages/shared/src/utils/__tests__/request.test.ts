import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import axios, { type AxiosInstance } from 'axios'

vi.mock('axios')

describe('request module', () => {
  const mockAxios = vi.mocked(axios, true)
  const axiosPostMock = mockAxios.post as unknown as Mock
  // instance 需可被当函数调用（401 续期后重放 instance(config)），因此基于 vi.fn() 组合
  const mockAxiosInstanceFn = vi.fn()
  const mockAxiosInstance = Object.assign(mockAxiosInstanceFn, {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: {
        use: vi.fn(),
      },
      response: {
        use: vi.fn(),
      },
    },
  })

  let get: Mock
  let post: Mock
  let put: Mock
  let del: Mock
  let requestInterceptor: Mock
  let requestErrorInterceptor: Mock
  let responseSuccessInterceptor: Mock
  let responseErrorInterceptor: Mock

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Setup mocks before importing the module
    mockAxios.create.mockReturnValue(mockAxiosInstance as unknown as AxiosInstance)
    mockAxiosInstance.interceptors.request.use.mockImplementation((success, error) => {
      requestInterceptor = success
      requestErrorInterceptor = error
      return success
    })
    mockAxiosInstance.interceptors.response.use.mockImplementation((success, error) => {
      responseSuccessInterceptor = success
      responseErrorInterceptor = error
      return [success, error] as unknown as number
    })

    // Dynamically import the module after mocks are set up
    const module = await import('../request')
    get = module.get as unknown as Mock
    post = module.post as unknown as Mock
    put = module.put as unknown as Mock
    del = module.del as unknown as Mock
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('request creation', () => {
    it('should create axios instance with correct config', () => {
      expect(axios.create).toHaveBeenCalled()
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled()
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled()
    })

    it('should use /api as default base URL', () => {
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: '/api',
        })
      )
    })

    it('should set timeout to 30000ms', () => {
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        })
      )
    })

    it('should set correct default headers', () => {
      expect(axios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
          },
        })
      )
    })
  })

  describe('request interceptors', () => {
    beforeEach(() => {
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      })
    })

    it('should add Authorization header when token exists', async () => {
      const mockConfig = { headers: {} }

      vi.mocked(localStorage.getItem).mockReturnValue('test-token')
      const result = await requestInterceptor(mockConfig)

      expect(result.headers.Authorization).toBe('Bearer test-token')
    })

    it('should not add Authorization header when token does not exist', async () => {
      const mockConfig = { headers: {} }

      vi.mocked(localStorage.getItem).mockReturnValue(null)
      const result = await requestInterceptor(mockConfig)

      expect(result.headers.Authorization).toBeUndefined()
    })

    it('should preserve existing config', async () => {
      const mockConfig = { headers: { 'X-Custom': 'value' } }

      vi.mocked(localStorage.getItem).mockReturnValue(null)
      const result = await requestInterceptor(mockConfig)

      expect(result.headers['X-Custom']).toBe('value')
    })

    it('should pass through request errors', async () => {
      const testError = new Error('Test request error')

      await expect(requestErrorInterceptor(testError)).rejects.toEqual(testError)
    })
  })

  describe('response interceptors - success', () => {
    beforeEach(() => {
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      })
      vi.stubGlobal('window', {
        location: {
          pathname: '/dashboard',
          reload: vi.fn(),
        },
      })
    })

    it('should return response when code is 0', async () => {
      const mockResponse = {
        data: {
          code: 0,
          message: 'success',
          data: { id: 1 },
        },
      }

      const result = await responseSuccessInterceptor(mockResponse)
      expect(result).toEqual(mockResponse)
    })

    it('should reject when code is not 0', async () => {
      const mockResponse = {
        data: {
          code: 400,
          message: 'Bad request',
          data: null,
        },
      }

      await expect(responseSuccessInterceptor(mockResponse)).rejects.toThrow('Bad request')
    })

    it('should reject with default message when no message provided', async () => {
      const mockResponse = {
        data: {
          code: 400,
          data: null,
        },
      }

      await expect(responseSuccessInterceptor(mockResponse)).rejects.toThrow('请求失败')
    })

    it('should handle 401 error on non-login page', async () => {
      const mockResponse = {
        data: {
          code: 401,
          message: 'Unauthorized',
        },
        config: { headers: {}, url: '/orders' },
      }

      // 无 refresh token 可用：清除登录态并刷新页面
      await expect(responseSuccessInterceptor(mockResponse)).rejects.toThrow('未登录或会话已过期')
      expect(localStorage.removeItem).toHaveBeenCalledWith('token')
      expect(localStorage.removeItem).toHaveBeenCalledWith('manager_token')
      expect(localStorage.removeItem).toHaveBeenCalledWith('admin_token')
      expect(window.location.reload).toHaveBeenCalled()
    })

    it('should not reload on 401 when on login page', async () => {
      window.location.pathname = '/login'
      const mockResponse = {
        data: {
          code: 401,
          message: 'Unauthorized',
        },
      }

      await expect(responseSuccessInterceptor(mockResponse)).rejects.toThrow('Unauthorized')
      expect(window.location.reload).not.toHaveBeenCalled()
    })

    it('should refresh token and replay request when refresh token exists on 401', async () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
        key === 'refresh_token' ? 'valid-refresh' : key === 'token' ? 'old-token' : null
      )
      // refreshTokens 内部使用裸 axios.post 调用刷新端点
      axiosPostMock.mockResolvedValue({
        data: { code: 0, data: { token: 'new-token', refreshToken: 'new-refresh' } },
      })
      // 重放请求成功
      mockAxiosInstanceFn.mockResolvedValue({
        data: { code: 0, message: 'ok', data: {} },
        config: {},
        headers: {},
        status: 200,
      })

      const mockResponse = {
        data: { code: 401, message: 'Unauthorized' },
        config: { headers: {}, url: '/orders' },
      }
      const result = await responseSuccessInterceptor(mockResponse)

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/refresh'),
        expect.objectContaining({ refreshToken: 'valid-refresh' }),
        expect.anything()
      )
      const replayConfig = mockAxiosInstanceFn.mock.calls[0][0]
      expect(replayConfig.headers.Authorization).toBe('Bearer new-token')
      expect((result as { data: { code: number } }).data.code).toBe(0)
      expect(window.location.reload).not.toHaveBeenCalled()
    })

    it('should refresh and replay when HTTP 401 with refresh token', async () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
        key === 'refresh_token' ? 'valid-refresh' : 'old-token'
      )
      axiosPostMock.mockResolvedValue({
        data: { code: 0, data: { token: 'new-token', refreshToken: 'new-refresh' } },
      })
      mockAxiosInstanceFn.mockResolvedValue({
        data: { code: 0, message: 'ok', data: {} },
        config: {},
        headers: {},
        status: 200,
      })

      const mockError = {
        response: { status: 401, data: { message: 'token expired' } },
        config: { headers: {}, url: '/orders' },
      }
      const result = await responseErrorInterceptor(mockError)

      expect(axiosPostMock).toHaveBeenCalled()
      const replayConfig = mockAxiosInstanceFn.mock.calls[0][0]
      expect(replayConfig.headers.Authorization).toBe('Bearer new-token')
      expect((result as { data: { code: number } }).data.code).toBe(0)
    })

    it('should clear tokens when replayed request fails after refresh', async () => {
      vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
        key === 'refresh_token' ? 'valid-refresh' : 'old-token'
      )
      axiosPostMock.mockResolvedValue({
        data: { code: 0, data: { token: 'new-token' } },
      })
      // 重放请求失败
      mockAxiosInstanceFn.mockRejectedValue(new Error('replay failed'))

      const mockResponse = {
        data: { code: 401, message: 'Unauthorized' },
        config: { headers: {}, url: '/orders' },
      }
      await expect(responseSuccessInterceptor(mockResponse)).rejects.toThrow('replay failed')
      expect(window.location.reload).toHaveBeenCalled()
    })
  })

  describe('response interceptors - error', () => {
    it('should extract error message from response data', async () => {
      const mockError = {
        response: {
          data: {
            message: 'Custom error message',
          },
        },
      }

      await expect(responseErrorInterceptor(mockError)).rejects.toThrow('Custom error message')
    })

    it('should use error message when no response data', async () => {
      const mockError = {
        message: 'Network Error',
      }

      await expect(responseErrorInterceptor(mockError)).rejects.toThrow('Network Error')
    })

    it('should use default message when no message available', async () => {
      const mockError = {}

      await expect(responseErrorInterceptor(mockError)).rejects.toThrow('网络错误')
    })
  })

  describe('request methods', () => {
    beforeEach(() => {
      const mockSuccessResponse = {
        data: {
          code: 0,
          message: 'success',
          data: { id: 1 },
        },
      }
      mockAxiosInstance.get.mockResolvedValue(mockSuccessResponse)
      mockAxiosInstance.post.mockResolvedValue(mockSuccessResponse)
      mockAxiosInstance.put.mockResolvedValue(mockSuccessResponse)
      mockAxiosInstance.delete.mockResolvedValue(mockSuccessResponse)
    })

    it('should send GET request with params', async () => {
      const params = { page: 1, pageSize: 10 }
      const result = await get('/test', params)

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test', { params })
      expect(result).toEqual({
        code: 0,
        message: 'success',
        data: { id: 1 },
      })
    })

    it('should send GET request without params', async () => {
      const result = await get('/test')

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test', { params: undefined })
      expect(result.code).toBe(0)
    })

    it('should send GET request with custom config', async () => {
      const params = { page: 1, pageSize: 10 }
      const config = { headers: { 'X-Custom': 'value' } }
      const result = await get('/test', params, config)

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test', { ...config, params })
      expect(result.code).toBe(0)
    })

    it('should send POST request with data', async () => {
      const data = { name: 'test' }
      const result = await post('/test', data)

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test', data, undefined)
      expect(result.code).toBe(0)
    })

    it('should send POST request with custom config', async () => {
      const data = { name: 'test' }
      const config = { headers: { 'X-Custom': 'value' } }
      const result = await post('/test', data, config)

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test', data, config)
      expect(result.code).toBe(0)
    })

    it('should send PUT request with data', async () => {
      const data = { id: 1, name: 'updated' }
      const result = await put('/test/1', data)

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/test/1', data, undefined)
      expect(result.code).toBe(0)
    })

    it('should send PUT request without data', async () => {
      const result = await put('/test/1')

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/test/1', undefined, undefined)
      expect(result.code).toBe(0)
    })

    it('should send PUT request with custom config', async () => {
      const data = { id: 1, name: 'updated' }
      const config = { headers: { 'X-Custom': 'value' } }
      const result = await put('/test/1', data, config)

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/test/1', data, config)
      expect(result.code).toBe(0)
    })

    it('should send DELETE request with data', async () => {
      const data = { reason: 'deleted' }
      const result = await del('/test/1', data)

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/test/1', { data: data })
      expect(result.code).toBe(0)
    })

    it('should send DELETE request without data', async () => {
      const result = await del('/test/1')

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/test/1', { data: undefined })
      expect(result.code).toBe(0)
    })

    it('should send DELETE request with custom config', async () => {
      const data = { reason: 'deleted' }
      const config = { headers: { 'X-Custom': 'value' } }
      const result = await del('/test/1', data, config)

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/test/1', { ...config, data: data })
      expect(result.code).toBe(0)
    })
  })

  describe('error cases', () => {
    beforeEach(() => {
      const mockError = new Error('Network Error')
      mockAxiosInstance.get.mockRejectedValue(mockError)
      mockAxiosInstance.post.mockRejectedValue(mockError)
      mockAxiosInstance.put.mockRejectedValue(mockError)
      mockAxiosInstance.delete.mockRejectedValue(mockError)
    })

    it('should reject on GET request error', async () => {
      await expect(get('/test')).rejects.toThrow()
    })

    it('should reject on POST request error', async () => {
      await expect(post('/test')).rejects.toThrow()
    })

    it('should reject on PUT request error', async () => {
      await expect(put('/test/1')).rejects.toThrow()
    })

    it('should reject on DELETE request error', async () => {
      await expect(del('/test/1')).rejects.toThrow()
    })
  })
})
