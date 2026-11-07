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

  // 版式基线：A4 纵向、一页宽；正文 12pt，避免 22pt 导致整表超出可打印宽度
  const FONT_NAME = 'Microsoft YaHei'
  const BODY_SIZE = 12
  const HEADER_SIZE = 13
  const TITLE_SIZE = 18
  const DECLARATION_SIZE = 10

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('派单表', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
    }
  })

  // 「更新备注」列在产品数据模型中没有来源（Product 无备注字段），已移除
  const headers = ['产品分类', '产品名称', '推广费(元/单)', '产品描述']

  const declaration = '声明：填写人需承诺所填信息已获授权，不侵犯他人合法权益；您提交的个人信息仅用于本次收集审核，我们承诺会严格保护您的隐私，不得将信息用于审核以外的任何用途，审核完毕也会定时删除清理。提交数据即表示您已充分理解并同意本条款，请自觉履行公民隐私保护义务，共同维护良好网络生态。'
  const declarationRow = worksheet.addRow([declaration])
  worksheet.mergeCells('A1:D1')
  declarationRow.eachCell((cell) => {
    cell.font = {
      name: FONT_NAME,
      color: { argb: 'FFFF0000' },
      size: DECLARATION_SIZE
    }
    cell.alignment = {
      horizontal: 'left',
      vertical: 'middle',
      wrapText: true
    }
  })
  declarationRow.height = 46

  const nextDay = new Date()
  nextDay.setDate(nextDay.getDate() + 1)
  const nextDayStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`
  // 标题明确写出「生效日期」，避免与文件名的导出日期混淆
  const titleRow = worksheet.addRow([`金卢比网络派单表（${nextDayStr} 生效）`])
  worksheet.mergeCells('A2:D2')
  titleRow.eachCell((cell) => {
    cell.font = {
      name: FONT_NAME,
      bold: true,
      size: TITLE_SIZE
    }
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle'
    }
  })
  titleRow.height = 30

  worksheet.headerFooter.oddFooter = `&L导出时间：${formatTime(new Date().toISOString())}&C第 &P 页 / 共 &N 页&R金卢比网络`

  const applyHeaderStyle = (row: ExcelJS.Row) => {
    row.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD700' }
      }
      cell.font = {
        name: FONT_NAME,
        bold: true,
        color: { argb: 'FF000000' },
        size: HEADER_SIZE
      }
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true
      }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    })
  }

  // 整表只保留一行表头，避免每个分类重复一次（打印时用 printTitlesRow 重复前 3 行）
  const headerRow = worksheet.addRow(headers)
  applyHeaderStyle(headerRow)
  headerRow.height = 24

  Object.keys(groupedProducts).forEach((categoryName) => {
    const groupProducts = groupedProducts[categoryName]
    const firstRowNumber = worksheet.rowCount + 1

    groupProducts.forEach((product, index) => {
      const dataRow = worksheet.addRow([
        index === 0 ? categoryName : null,
        product.title,
        product.price,
        product.description
      ])
      dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = {
          name: FONT_NAME,
          size: BODY_SIZE
        }
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 3 ? 'right' : colNumber === 1 ? 'center' : 'left',
          wrapText: colNumber === 2 || colNumber === 4
        }
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
        if (colNumber === 3) {
          cell.numFmt = '¥#,##0'
        }
      })
    })

    // 仅当分组内多于一条产品时才合并分类列，避免 A10:A10 这类单格合并
    if (groupProducts.length > 1) {
      worksheet.mergeCells(`A${firstRowNumber}:A${worksheet.rowCount}`)
    }
  })

  // 列宽按显示宽度计算（中文按 2 个单位），不再按字符数 + 硬封顶 50
  const displayWidth = (value: string): number =>
    Array.from(value).reduce((width, ch) => width + (ch.charCodeAt(0) > 127 ? 2 : 1), 0)

  const maxWidths: number[] = [0, 0, 0, 0]
  worksheet.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (colNumber > headers.length) return
      const text = cell.value == null ? '' : String(cell.value)
      maxWidths[colNumber - 1] = Math.max(maxWidths[colNumber - 1], displayWidth(text))
    })
  })

  headers.forEach((header, index) => {
    maxWidths[index] = Math.max(maxWidths[index], displayWidth(header))
  })

  const columnLimits: Array<[number, number]> = [[8, 12], [24, 34], [10, 14], [40, 60]]
  worksheet.columns.forEach((col, index) => {
    const [min, max] = columnLimits[index] || [20, 40]
    col.width = Math.min(Math.max(maxWidths[index] + 2, min), max)
  })

  return workbook
}

// 将二维码追加到派单表末尾：最后一行合并 A-D 列，图片在合并单元格内水平/垂直居中
// （插入失败仅警告，不中断导出）
export const appendQrCodeToWorkbook = (workbook: ExcelJS.Workbook, qrCodeDataUrl: string) => {
  const worksheet = workbook.getWorksheet('派单表')
  if (!worksheet || !qrCodeDataUrl) return

  const qrCodeRow = worksheet.addRow([null, null, null, null])

  // 先给整行加样式和边框，再合并，保证合并区域四周都有与表体一致的细边框
  qrCodeRow.eachCell({ includeEmpty: true }, (cell) => {
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

    // 目标宽度 240px（原 200px 在打印缩放后偏小），按原始比例换算高度
    const imgWidthPx = 240
    const imgHeightPx = naturalWidth > 0 && naturalHeight > 0
      ? Math.round(imgWidthPx * naturalHeight / naturalWidth)
      : imgWidthPx
    const paddingPx = 12

    // 行高 = 图片高 + 上下留白（磅 = 像素 * 0.75），保证图片完整落在最后一行内
    qrCodeRow.height = (imgHeightPx + paddingPx * 2) * 0.75
    worksheet.mergeCells(`A${qrCodeRow.number}:D${qrCodeRow.number}`)

    // 估算 A-D 合并区域的像素宽度，计算图片居中所需的偏移
    const colWidthToPx = (width?: number) => (width ? Math.round(width * 7 + 5) : 64)
    const mergedWidthPx = [1, 2, 3, 4].reduce(
      (sum, col) => sum + colWidthToPx(worksheet.getColumn(col).width),
      0
    )
    const offsetXPx = Math.max((mergedWidthPx - imgWidthPx) / 2, 0)
    const pxToEmu = (px: number) => Math.round(px * 9525)

    // 注意：ExcelJS 只认 nativeColOff/nativeRowOff，tl.colOff/rowOff 会被静默归零
    worksheet.addImage(qrCodeImage, {
      tl: {
        nativeCol: 0,
        nativeRow: qrCodeRow.number - 1,
        nativeColOff: pxToEmu(offsetXPx),
        nativeRowOff: pxToEmu(paddingPx)
      },
      ext: { width: imgWidthPx, height: imgHeightPx }
    } as unknown as Parameters<ExcelJS.Worksheet['addImage']>[1]) // 类型声明未覆盖 native 偏移，运行时支持
  } catch (error) {
    logger.error('Failed to add QR code to Excel:', error)
    ElMessage.warning('二维码插入失败')
  }

  // 二维码说明行（含用途与导出时间），避免渠道方拿到图后不知道用途/版本
  const captionRow = worksheet.addRow([`扫码开户 · 导出时间：${formatTime(new Date().toISOString())}`])
  captionRow.height = 18
  worksheet.mergeCells(`A${captionRow.number}:D${captionRow.number}`)
  captionRow.eachCell((cell) => {
    cell.font = {
      name: 'Microsoft YaHei',
      size: 9,
      color: { argb: 'FF808080' }
    }
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle'
    }
  })

  // 打印区域覆盖到最后的说明行；第 2-3 行（标题/表头）作为重复表头，不重复声明行
  worksheet.pageSetup.printArea = `A1:D${captionRow.number}`
  worksheet.pageSetup.printTitlesRow = '2:3'
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
