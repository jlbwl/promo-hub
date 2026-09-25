/**
 * 分类管理页共享纯函数：时间格式化、二维码图片处理、派单表构建与下载
 */
import ExcelJS from 'exceljs'
import { logger } from '@promo/shared/utils/logger'
import { ElMessage } from 'element-plus'
import type { Product, ProductCategory } from '@promo/shared/types'

// 二维码条目（/admin/qrcodes 返回结构）
export interface QrCodeItem {
  id: string
  url: string
  dataUrl: string
  isDefault: boolean
  createdAt: number
  centerText?: string
  topText?: string
}

// 格式化时间（北京时区 UTC+8）
export const formatTime = (iso: string) => {
  if (!iso) return '--'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1
  let day = d.getUTCDate()
  let hours = d.getUTCHours() + 8
  if (hours >= 24) {
    hours -= 24
    day += 1
  }
  return `${year}-${p(month)}-${p(day)} ${p(hours)}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}

// 在二维码图片上方/中心拼接文字后返回新的 dataUrl（无文字时原样返回）
export const addTextToQrCode = async (qrCodeDataUrl: string, topText: string, centerText: string): Promise<string> => {
  if (!topText && !centerText) {
    return qrCodeDataUrl
  }
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      resolve(qrCodeDataUrl)
      return
    }

    const img = new Image()
    img.onload = () => {
      const padding = 30
      const textHeight = 30
      const totalHeight = img.height + (topText ? textHeight : 0) + padding * 2
      const totalWidth = Math.max(img.width, 260)

      canvas.width = totalWidth
      canvas.height = totalHeight

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      let currentY = padding
      if (topText) {
        ctx.font = 'bold 16px Microsoft YaHei'
        ctx.fillStyle = '#000000'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(topText, canvas.width / 2, currentY + textHeight / 2)
        currentY += textHeight
      }

      const imgX = (canvas.width - img.width) / 2
      ctx.drawImage(img, imgX, currentY)

      if (centerText) {
        ctx.font = 'bold 14px Microsoft YaHei'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const centerX = canvas.width / 2
        const centerY = currentY + img.height / 2

        const textWidth = ctx.measureText(centerText).width
        const bgPadding = 6
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(centerX - textWidth / 2 - bgPadding, centerY - 12, textWidth + bgPadding * 2, 24)

        ctx.fillStyle = '#000000'
        ctx.fillText(centerText, centerX, centerY)
      }

      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      resolve(qrCodeDataUrl)
    }
    img.src = qrCodeDataUrl
  })
}

// 构建派单表工作簿：声明行、标题行、按分类分组的表头与数据行、列宽
export const createDispatchWorkbook = (products: Product[], categories: ProductCategory[]): ExcelJS.Workbook => {
  const categoryMap = new Map(categories.map(c => [c.value, c.name]))

  const mappedProducts = products.map((product: Product) => ({
    categoryName: categoryMap.get(product.category) || product.category || '未分类',
    title: product.title,
    price: product.price,
    description: product.description || ''
  }))

  mappedProducts.sort((a, b) => a.categoryName.localeCompare(b.categoryName, 'zh-CN'))

  const groupedProducts = mappedProducts.reduce((acc, product) => {
    if (!acc[product.categoryName]) {
      acc[product.categoryName] = []
    }
    acc[product.categoryName].push(product)
    return acc
  }, {} as Record<string, typeof mappedProducts>)

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('派单表')

  const headers = ['产品分类', '产品名称', '更新备注', '推广费', '产品描述']

  const declaration = '声明：填写人需承诺所填信息已获授权，不侵犯他人合法权益，您提交的个人信息仅用于本次收集审核，我们承诺会严格保护您的隐私，不得将信息用于审核以外的任何用途,审核完毕也会定时删除清理。提交数据即表示您已充分理解并同意本条款，请自觉履行公民隐私保护义务，共同维护良好网络生态。'
  const declarationRow = worksheet.addRow([declaration])
  worksheet.mergeCells(`A1:E1`)
  declarationRow.eachCell((cell) => {
    cell.font = {
      color: { argb: 'FFFF0000' },
      size: 11
    }
    cell.alignment = {
      horizontal: 'left',
      vertical: 'middle',
      wrapText: true
    }
  })
  declarationRow.height = 60

  const nextDay = new Date()
  nextDay.setDate(nextDay.getDate() + 1)
  const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`
  const titleRow = worksheet.addRow([`金卢比网络 ${nextDayStr} 派单表`])
  worksheet.mergeCells(`A2:E2`)
  titleRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      size: 14
    }
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle'
    }
  })
  titleRow.height = 30

  const applyHeaderStyle = (row: ExcelJS.Row) => {
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD700' }
      }
      cell.font = {
        bold: true,
        color: { argb: 'FF000000' }
      }
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle'
      }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    })
  }

  const rowHeight = 18

  Object.keys(groupedProducts).forEach((categoryName) => {
    const categoryHeaderRow = worksheet.addRow(headers)
    applyHeaderStyle(categoryHeaderRow)
    categoryHeaderRow.height = rowHeight

    const productRows: ExcelJS.Row[] = []
    groupedProducts[categoryName].forEach(product => {
      const dataRow = worksheet.addRow(['', product.title, '', product.price, product.description])
      dataRow.height = rowHeight
      productRows.push(dataRow)
    })

    if (productRows.length > 0) {
      productRows[0].getCell(1).value = categoryName
      worksheet.mergeCells(`A${productRows[0].number}:A${productRows[productRows.length - 1].number}`)
    }

    productRows.forEach(dataRow => {
      dataRow.eachCell((cell, colNumber) => {
        cell.alignment = {
          vertical: 'middle',
          horizontal: (colNumber === 1 || colNumber === 4) ? 'center' : 'left'
        }
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      })
    })
  })

  const maxLengths: number[] = [0, 0, 0, 0, 0]
  worksheet.eachRow((row) => {
    row.eachCell((cell, colNumber) => {
      const value = cell.value?.toString() || ''
      const length = value.length
      if (length > maxLengths[colNumber - 1]) {
        maxLengths[colNumber - 1] = length
      }
    })
  })

  headers.forEach((header, index) => {
    const headerLength = header.length
    if (headerLength > maxLengths[index]) {
      maxLengths[index] = headerLength
    }
  })

  const columnWidths = maxLengths.map(len => Math.min(len * 1.5 + 2, 50))
  worksheet.columns.forEach((col, index) => {
    if (index === 0 || index === 2 || index === 3) {
      col.width = 20
    } else {
      col.width = columnWidths[index] + 5
    }
  })

  return workbook
}

// 将二维码图片追加到派单表末尾（插入失败仅警告，不中断导出）
export const appendQrCodeToWorkbook = (workbook: ExcelJS.Workbook, qrCodeDataUrl: string) => {
  const worksheet = workbook.getWorksheet('派单表')
  if (!worksheet || !qrCodeDataUrl) return

  worksheet.addRow(['', '', '', '', ''])

  const qrCodeRow = worksheet.addRow([''])
  qrCodeRow.height = 200

  worksheet.mergeCells(`A${qrCodeRow.number}:E${qrCodeRow.number}`)

  qrCodeRow.eachCell((cell) => {
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle'
    }
  })

  try {
    const base64Data = qrCodeDataUrl.split(',')[1]
    const qrCodeImage = workbook.addImage({
      base64: base64Data,
      extension: 'png'
    })

    worksheet.addImage(qrCodeImage, {
      tl: { col: 1, row: qrCodeRow.number - 1 },
      br: { col: 4, row: qrCodeRow.number },
      editAs: 'oneCell'
    } as Parameters<ExcelJS.Worksheet['addImage']>[1])
  } catch (error) {
    logger.error('Failed to add QR code to Excel:', error)
    ElMessage.warning('二维码插入失败')
  }
}

// 生成 xlsx 并触发浏览器下载
export const downloadWorkbook = async (workbook: ExcelJS.Workbook, fileName: string) => {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
