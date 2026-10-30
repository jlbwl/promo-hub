/**
 * 分类管理页共享纯函数：时间格式化、二维码图片处理、派单表构建与下载
 */
import ExcelJS from 'exceljs'
import { logger } from '@promo/shared/utils/logger'
import { formatDate } from '@promo/shared/utils/helpers'
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

// 格式化时间（shared 统一北京时区实现，秒级）
export const formatTime = (iso: string) => (iso ? formatDate(iso) : '--')

// 导出前清洗产品描述：去除所有 HTML 标签（含 img/br/p 等），只保留纯文字
export const stripHtmlTags = (html: string): string =>
  html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

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
    description: stripHtmlTags(product.description || '')
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
      size: 22
    }
    cell.alignment = {
      horizontal: 'left',
      vertical: 'middle',
      wrapText: true
    }
  })
  declarationRow.height = 120

  const nextDay = new Date()
  nextDay.setDate(nextDay.getDate() + 1)
  const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`
  const titleRow = worksheet.addRow([`金卢比网络 ${nextDayStr} 派单表`])
  worksheet.mergeCells(`A2:E2`)
  titleRow.eachCell((cell) => {
    cell.font = {
      bold: true,
      size: 28
    }
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle'
    }
  })
  titleRow.height = 60

  const applyHeaderStyle = (row: ExcelJS.Row) => {
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD700' }
      }
      cell.font = {
        bold: true,
        color: { argb: 'FF000000' },
        size: 22
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

  const rowHeight = 36

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
        cell.font = {
          size: 22
        }
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

// 将二维码图片追加到派单表末尾：最后一行合并 A-D 列，图片在合并单元格内居中
// （插入失败仅警告，不中断导出）
export const appendQrCodeToWorkbook = (workbook: ExcelJS.Workbook, qrCodeDataUrl: string) => {
  const worksheet = workbook.getWorksheet('派单表')
  if (!worksheet || !qrCodeDataUrl) return

  worksheet.addRow(['', '', '', '', ''])

  const qrCodeRow = worksheet.addRow([''])
  qrCodeRow.height = 200

  // 最后一行第 1~4 列合并为独立单元格，专用于展示二维码
  worksheet.mergeCells(`A${qrCodeRow.number}:D${qrCodeRow.number}`)

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

    // 从 PNG 头同步读取原始宽高，保证二维码等比缩放不变形
    let naturalWidth = 0
    let naturalHeight = 0
    try {
      const binary = atob(base64Data.slice(0, 64))
      naturalWidth = ((binary.charCodeAt(16) << 24) | (binary.charCodeAt(17) << 16) | (binary.charCodeAt(18) << 8) | binary.charCodeAt(19)) >>> 0
      naturalHeight = ((binary.charCodeAt(20) << 24) | (binary.charCodeAt(21) << 16) | (binary.charCodeAt(22) << 8) | binary.charCodeAt(23)) >>> 0
    } catch {
      naturalWidth = 0
      naturalHeight = 0
    }

    // 目标宽度 200px，按原始比例换算高度（读不到尺寸时按正方形处理）
    const imgWidthPx = 200
    const imgHeightPx = naturalWidth > 0 && naturalHeight > 0
      ? Math.round(imgWidthPx * naturalHeight / naturalWidth)
      : imgWidthPx

    // 估算 A-D 合并区域的像素宽度，计算图片居中所需的偏移
    const colWidthToPx = (width?: number) => (width ? width * 7 + 5 : 64)
    const mergedWidthPx = [1, 2, 3, 4].reduce(
      (sum, col) => sum + colWidthToPx(worksheet.getColumn(col).width),
      0
    )
    const offsetXPx = Math.max((mergedWidthPx - imgWidthPx) / 2, 0)
    const rowHeightPx = 200 * 4 / 3 // 行高单位是磅，换算为像素
    const offsetYPx = Math.max((rowHeightPx - imgHeightPx) / 2, 0)
    const pxToEmu = (px: number) => Math.round(px * 9525)

    worksheet.addImage(qrCodeImage, {
      tl: {
        col: 0,
        row: qrCodeRow.number - 1,
        colOff: pxToEmu(offsetXPx),
        rowOff: pxToEmu(offsetYPx)
      },
      ext: { width: imgWidthPx, height: imgHeightPx }
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
