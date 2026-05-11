import { describe, it, expect } from 'vitest'
import {
  UserRole,
  CommissionStatus,
  type User,
  type Manager,
  type Product,
  type ProductCategory,
  type Commission,
  type CommissionSummary,
  type PaginatedResponse,
  type ApiResponse,
  type PaginationParams,
  type LoginParams,
  type LoginResult,
} from '../index'

describe('types - enums', () => {
  describe('UserRole', () => {
    it('should have correct role values', () => {
      expect(UserRole.ADMIN).toBe('admin')
      expect(UserRole.MANAGER).toBe('manager')
      expect(UserRole.USER).toBe('user')
    })

    it('should have all three roles', () => {
      const roles = Object.values(UserRole)
      expect(roles).toHaveLength(3)
      expect(roles).toContain('admin')
      expect(roles).toContain('manager')
      expect(roles).toContain('user')
    })

    it('should have correct enum keys', () => {
      const keys = Object.keys(UserRole)
      expect(keys).toEqual(['ADMIN', 'MANAGER', 'USER'])
    })
  })

  describe('CommissionStatus', () => {
    it('should have correct status values', () => {
      expect(CommissionStatus.PENDING).toBe('pending')
      expect(CommissionStatus.APPROVED).toBe('approved')
      expect(CommissionStatus.PAID).toBe('paid')
      expect(CommissionStatus.REJECTED).toBe('rejected')
    })

    it('should have all four statuses', () => {
      const statuses = Object.values(CommissionStatus)
      expect(statuses).toHaveLength(4)
    })

    it('should have correct enum keys', () => {
      const keys = Object.keys(CommissionStatus)
      expect(keys).toEqual(['PENDING', 'APPROVED', 'PAID', 'REJECTED'])
    })
  })
})

describe('types - interfaces', () => {
  describe('User', () => {
    it('should accept valid user object', () => {
      const user: User = {
        id: '1',
        name: 'Test User',
        phone: '13800138000',
        role: UserRole.USER,
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      expect(user.id).toBe('1')
      expect(user.name).toBe('Test User')
      expect(user.role).toBe(UserRole.USER)
      expect(user.status).toBe('active')
    })

    it('should accept optional avatar', () => {
      const userWithAvatar: User = {
        id: '1',
        name: 'Test User',
        phone: '13800138000',
        role: UserRole.USER,
        status: 'active',
        avatar: 'https://example.com/avatar.jpg',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      expect(userWithAvatar.avatar).toBe('https://example.com/avatar.jpg')
    })

    it('should accept different user statuses', () => {
      const statuses: User['status'][] = ['active', 'inactive', 'banned']
      
      statuses.forEach((status) => {
        const user: User = {
          id: '1',
          name: 'Test User',
          phone: '13800138000',
          role: UserRole.USER,
          status,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }
        expect(user.status).toBe(status)
      })
    })
  })

  describe('Manager', () => {
    it('should extend User with manager-specific fields', () => {
      const manager: Manager = {
        id: '1',
        name: 'Test Manager',
        phone: '13800138000',
        role: UserRole.MANAGER,
        status: 'active',
        totalCommission: 5000,
        managedUserCount: 100,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      expect(manager.role).toBe(UserRole.MANAGER)
      expect(manager.totalCommission).toBe(5000)
      expect(manager.managedUserCount).toBe(100)
    })

    it('should have role always as MANAGER', () => {
      const manager: Manager = {
        id: '1',
        name: 'Test Manager',
        phone: '13800138000',
        role: UserRole.MANAGER,
        status: 'active',
        totalCommission: 0,
        managedUserCount: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      expect(manager.role).toBe('manager')
    })
  })

  describe('Product', () => {
    it('should accept valid product object', () => {
      const product: Product = {
        id: '1',
        title: 'Test Product',
        description: 'Description',
        coverImage: 'https://example.com/cover.jpg',
        price: 99.99,
        category: 'Electronics',
        status: 'published',
        publishedBy: 'admin',
        publishedAt: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      expect(product.id).toBe('1')
      expect(product.title).toBe('Test Product')
      expect(product.price).toBe(99.99)
    })

    it('should accept optional original price', () => {
      const product: Product = {
        id: '1',
        title: 'Test Product',
        description: 'Description',
        coverImage: 'https://example.com/cover.jpg',
        price: 79.99,
        originalPrice: 99.99,
        category: 'Electronics',
        status: 'published',
        publishedBy: 'admin',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      expect(product.originalPrice).toBe(99.99)
    })

    it('should accept optional images array', () => {
      const product: Product = {
        id: '1',
        title: 'Test Product',
        description: 'Description',
        coverImage: 'https://example.com/cover.jpg',
        images: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg',
        ],
        price: 99.99,
        category: 'Electronics',
        status: 'published',
        publishedBy: 'admin',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      expect(product.images).toHaveLength(2)
    })

    it('should accept different product statuses', () => {
      const statuses: Product['status'][] = ['draft', 'published', 'archived']
      
      statuses.forEach((status) => {
        const product: Product = {
          id: '1',
          title: 'Test Product',
          description: 'Description',
          coverImage: 'https://example.com/cover.jpg',
          price: 99.99,
          category: 'Electronics',
          status,
          publishedBy: 'admin',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }
        expect(product.status).toBe(status)
      })
    })
  })

  describe('ProductCategory', () => {
    it('should accept valid category object', () => {
      const category: ProductCategory = {
        id: '1',
        name: 'Electronics',
        sort: 1,
      }

      expect(category.id).toBe('1')
      expect(category.name).toBe('Electronics')
      expect(category.sort).toBe(1)
    })

    it('should accept optional icon', () => {
      const category: ProductCategory = {
        id: '1',
        name: 'Electronics',
        icon: 'laptop',
        sort: 1,
      }

      expect(category.icon).toBe('laptop')
    })
  })

  describe('Commission', () => {
    it('should accept valid commission object', () => {
      const commission: Commission = {
        id: '1',
        userId: 'user1',
        userName: 'Test User',
        productId: 'product1',
        productTitle: 'Test Product',
        amount: 50.00,
        status: CommissionStatus.PENDING,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      expect(commission.id).toBe('1')
      expect(commission.amount).toBe(50.00)
      expect(commission.status).toBe(CommissionStatus.PENDING)
    })

    it('should accept optional approval fields', () => {
      const commission: Commission = {
        id: '1',
        userId: 'user1',
        userName: 'Test User',
        productId: 'product1',
        productTitle: 'Test Product',
        amount: 50.00,
        status: CommissionStatus.APPROVED,
        approvedBy: 'admin',
        approvedAt: '2024-01-02T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      }

      expect(commission.approvedBy).toBe('admin')
      expect(commission.approvedAt).toBeDefined()
    })

    it('should accept optional payment fields', () => {
      const commission: Commission = {
        id: '1',
        userId: 'user1',
        userName: 'Test User',
        productId: 'product1',
        productTitle: 'Test Product',
        amount: 50.00,
        status: CommissionStatus.PAID,
        approvedBy: 'admin',
        approvedAt: '2024-01-02T00:00:00Z',
        paidAt: '2024-01-03T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-03T00:00:00Z',
      }

      expect(commission.paidAt).toBeDefined()
    })

    it('should accept all commission statuses', () => {
      const statuses = [
        CommissionStatus.PENDING,
        CommissionStatus.APPROVED,
        CommissionStatus.PAID,
        CommissionStatus.REJECTED,
      ]

      statuses.forEach((status) => {
        const commission: Commission = {
          id: '1',
          userId: 'user1',
          userName: 'Test User',
          productId: 'product1',
          productTitle: 'Test Product',
          amount: 50.00,
          status,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }
        expect(commission.status).toBe(status)
      })
    })
  })

  describe('CommissionSummary', () => {
    it('should accept valid summary object', () => {
      const summary: CommissionSummary = {
        total: 10000,
        pending: 2000,
        approved: 3000,
        paid: 5000,
      }

      expect(summary.total).toBe(10000)
      expect(summary.pending).toBe(2000)
      expect(summary.approved).toBe(3000)
      expect(summary.paid).toBe(5000)
    })

    it('should have positive values', () => {
      const summary: CommissionSummary = {
        total: 0,
        pending: 0,
        approved: 0,
        paid: 0,
      }

      expect(summary.total).toBeGreaterThanOrEqual(0)
      expect(summary.pending).toBeGreaterThanOrEqual(0)
      expect(summary.approved).toBeGreaterThanOrEqual(0)
      expect(summary.paid).toBeGreaterThanOrEqual(0)
    })
  })
})

describe('types - generic interfaces', () => {
  describe('PaginatedResponse', () => {
    it('should accept valid paginated response', () => {
      const response: PaginatedResponse<User> = {
        list: [
          {
            id: '1',
            name: 'User 1',
            phone: '13800138001',
            role: UserRole.USER,
            status: 'active',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: '2',
            name: 'User 2',
            phone: '13800138002',
            role: UserRole.USER,
            status: 'active',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        total: 100,
        page: 1,
        pageSize: 10,
      }

      expect(response.list).toHaveLength(2)
      expect(response.total).toBe(100)
      expect(response.page).toBe(1)
      expect(response.pageSize).toBe(10)
    })

    it('should work with Product type', () => {
      const response: PaginatedResponse<Product> = {
        list: [],
        total: 0,
        page: 1,
        pageSize: 10,
      }

      expect(response.list).toBeInstanceOf(Array)
    })

    it('should accept page 2 response', () => {
      const response: PaginatedResponse<User> = {
        list: [],
        total: 50,
        page: 2,
        pageSize: 20,
      }

      expect(response.page).toBe(2)
      expect(response.total).toBe(50)
    })
  })

  describe('ApiResponse', () => {
    it('should accept success response', () => {
      const response: ApiResponse<User> = {
        code: 0,
        message: 'success',
        data: {
          id: '1',
          name: 'Test User',
          phone: '13800138000',
          role: UserRole.USER,
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      }

      expect(response.code).toBe(0)
      expect(response.data.id).toBe('1')
    })

    it('should accept error response', () => {
      const response: ApiResponse<null> = {
        code: 400,
        message: 'Bad request',
        data: null,
      }

      expect(response.code).toBe(400)
      expect(response.data).toBeNull()
    })

    it('should work with unknown type', () => {
      const response: ApiResponse = {
        code: 0,
        message: 'success',
        data: {},
      }

      expect(response.code).toBe(0)
    })
  })
})

describe('types - params and results', () => {
  describe('PaginationParams', () => {
    it('should accept valid pagination params', () => {
      const params: PaginationParams = {
        page: 1,
        pageSize: 10,
      }

      expect(params.page).toBe(1)
      expect(params.pageSize).toBe(10)
    })

    it('should accept different page sizes', () => {
      const pageSizes = [10, 20, 50, 100]

      pageSizes.forEach((pageSize) => {
        const params: PaginationParams = {
          page: 1,
          pageSize,
        }
        expect(params.pageSize).toBe(pageSize)
      })
    })
  })

  describe('LoginParams', () => {
    it('should accept valid login params', () => {
      const params: LoginParams = {
        phone: '13800138000',
        password: 'password123',
      }

      expect(params.phone).toBe('13800138000')
      expect(params.password).toBe('password123')
    })
  })

  describe('LoginResult', () => {
    it('should accept valid login result', () => {
      const result: LoginResult = {
        token: 'jwt-token',
        refreshToken: 'refresh-token',
        user: {
          id: '1',
          name: 'Test User',
          phone: '13800138000',
          role: UserRole.USER,
          status: 'active',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      }

      expect(result.token).toBe('jwt-token')
      expect(result.refreshToken).toBe('refresh-token')
      expect(result.user.role).toBe(UserRole.USER)
    })
  })
})

describe('types - practical usage', () => {
  it('should support CRUD operations flow', () => {
    // Create
    const newProduct: Product = {
      id: '1',
      title: 'New Product',
      description: 'Description',
      coverImage: 'https://example.com/cover.jpg',
      price: 99.99,
      category: 'Electronics',
      status: 'draft',
      publishedBy: 'admin',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }

    // Update
    const updatedProduct: Product = {
      ...newProduct,
      status: 'published',
      publishedAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    }

    expect(updatedProduct.status).toBe('published')

    // List with pagination
    const paginatedProducts: PaginatedResponse<Product> = {
      list: [updatedProduct],
      total: 1,
      page: 1,
      pageSize: 10,
    }

    expect(paginatedProducts.list).toHaveLength(1)
  })

  it('should support commission workflow', () => {
    // Create commission
    const commission: Commission = {
      id: '1',
      userId: 'user1',
      userName: 'Test User',
      productId: 'product1',
      productTitle: 'Test Product',
      amount: 50.00,
      status: CommissionStatus.PENDING,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }

    // Approve commission
    const approvedCommission: Commission = {
      ...commission,
      status: CommissionStatus.APPROVED,
      approvedBy: 'admin',
      approvedAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    }

    // Pay commission
    const paidCommission: Commission = {
      ...approvedCommission,
      status: CommissionStatus.PAID,
      paidAt: '2024-01-03T00:00:00Z',
      updatedAt: '2024-01-03T00:00:00Z',
    }

    expect(paidCommission.status).toBe(CommissionStatus.PAID)
    expect(paidCommission.paidAt).toBeDefined()
  })

  it('should support user management workflow', () => {
    // Login
    const loginResult: LoginResult = {
      token: 'jwt-token',
      refreshToken: 'refresh-token',
      user: {
        id: '1',
        name: 'Test Manager',
        phone: '13800138000',
        role: UserRole.MANAGER,
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    }

    // Create manager from login result
    const manager: Manager = {
      ...loginResult.user,
      totalCommission: 0,
      managedUserCount: 0,
    }

    expect(manager.role).toBe(UserRole.MANAGER)
  })
})
