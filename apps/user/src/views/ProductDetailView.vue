<template>
  <div class="product-detail-page">
    <!-- 顶部导航栏 -->
    <van-nav-bar
      title="产品详情"
      left-arrow
      fixed
      placeholder
      @click-left="router.back()"
    />

    <!-- 产品轮播图 -->
    <van-swipe :autoplay="3000" indicator-color="#1989fa" class="product-swipe">
      <van-swipe-item v-for="(image, index) in product.images" :key="index">
        <van-image
          width="100%"
          height="375"
          fit="cover"
          :src="image"
        >
          <template #error>
            <div class="image-placeholder">
              <van-icon name="photo-fail" size="48" color="#ddd" />
            </div>
          </template>
        </van-image>
      </van-swipe-item>
    </van-swipe>

    <!-- 产品基本信息 -->
    <div class="product-info">
      <div class="price-row">
        <span class="price">¥{{ product.price }}</span>
        <span class="commission-badge">
          <van-icon name="gold-coin-o" />
          推广赚 ¥{{ product.commission }}
        </span>
      </div>
      <h2 class="title">{{ product.title }}</h2>
      <div class="meta-row">
        <span class="sales">已售 {{ product.sales }} 件</span>
        <span class="rate">好评率 {{ product.rate }}</span>
      </div>
    </div>

    <!-- 佣金说明 -->
    <van-cell-group inset class="commission-card">
      <van-cell title="佣金说明" icon="gold-coin-o" is-link />
      <van-cell>
        <template #title>
          <div class="commission-detail">
            <div class="commission-item">
              <span class="label">佣金比例</span>
              <span class="value">{{ product.commissionRate }}</span>
            </div>
            <div class="commission-item">
              <span class="label">预计佣金</span>
              <span class="value highlight">¥{{ product.commission }}</span>
            </div>
            <div class="commission-item">
              <span class="label">结算周期</span>
              <span class="value">{{ product.settlementPeriod }}</span>
            </div>
          </div>
        </template>
      </van-cell>
    </van-cell-group>

    <!-- 产品描述 -->
    <div class="product-desc">
      <h3 class="section-title">产品描述</h3>
      <div class="desc-content" v-html="product.description"></div>
    </div>

    <!-- 底部操作栏 -->
    <van-action-bar>
      <van-action-bar-icon icon="chat-o" text="客服" />
      <van-action-bar-icon icon="star-o" text="收藏" />
      <van-action-bar-icon icon="share-o" text="分享" @click="handleShare" />
      <van-action-bar-button
        type="primary"
        text="推广赚钱"
        @click="handlePromote"
      />
    </van-action-bar>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { showToast, showDialog } from 'vant'

// 路由实例
const router = useRouter()
const route = useRoute()

// 获取产品 ID
const productId = Number(route.params.id)

// 模拟产品数据
const product = reactive({
  id: productId,
  title: '无线蓝牙耳机 主动降噪 运动防水 高品质音效 长续航',
  price: '199.00',
  commission: '30.00',
  commissionRate: '15%',
  sales: '2.3万',
  rate: '98%',
  settlementPeriod: '确认收货后7天',
  images: ['', '', ''],
  description: `
    <p>产品特点：</p>
    <ul>
      <li>主动降噪技术，沉浸式音质体验</li>
      <li>IPX5防水等级，运动无忧</li>
      <li>蓝牙5.0，稳定连接不断开</li>
      <li>30小时超长续航，满足全天使用</li>
      <li>轻量化设计，佩戴舒适无感</li>
    </ul>
    <p>适合人群：运动爱好者、通勤族、音乐发烧友</p>
  `
})

// TODO: 根据 productId 调用接口获取真实产品数据

// 分享产品
const handleShare = () => {
  // TODO: 调用分享功能
  showDialog({
    title: '分享产品',
    message: '分享链接已复制到剪贴板，快去分享给好友吧！',
    confirmButtonText: '知道了'
  })
}

// 推广产品
const handlePromote = () => {
  // TODO: 生成推广链接或海报
  showToast('推广链接已生成，快去分享吧！')
}
</script>

<style scoped lang="scss">
.product-detail-page {
  min-height: 100%;
  background-color: #f7f8fa;
  padding-bottom: 60px;
}

// 轮播图
.product-swipe {
  .image-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    background-color: #f5f5f5;
  }
}

// 产品信息
.product-info {
  background-color: #ffffff;
  padding: 16px;
  margin-bottom: 12px;
}

.price-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.price {
  font-size: 24px;
  font-weight: 700;
  color: #ee0a24;
}

.commission-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  color: #ffffff;
  background: linear-gradient(135deg, #ff6034, #ee0a24);
}

.title {
  font-size: 16px;
  font-weight: 500;
  color: #323233;
  line-height: 1.5;
  margin-bottom: 8px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 12px;
  color: #969799;
}

// 佣金卡片
.commission-card {
  margin-bottom: 12px;
  border-radius: 8px;
  overflow: hidden;
}

.commission-detail {
  width: 100%;
}

.commission-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 14px;

  .label {
    color: #969799;
  }

  .value {
    color: #323233;

    &.highlight {
      color: #ee0a24;
      font-weight: 600;
    }
  }
}

// 产品描述
.product-desc {
  background-color: #ffffff;
  padding: 16px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #323233;
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 3px solid #1989fa;
}

.desc-content {
  font-size: 14px;
  color: #666;
  line-height: 1.8;

  :deep(ul) {
    padding-left: 20px;
    margin: 8px 0;
  }

  :deep(li) {
    margin-bottom: 4px;
  }
}
</style>
