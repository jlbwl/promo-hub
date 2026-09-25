<template>
  <!-- 用户信息区域 -->
  <div class="user-header">
    <div class="user-info">
      <van-image
        round
        width="64"
        height="64"
        :src="userInfo.avatar"
        fit="cover"
      >
        <template #error>
          <div class="avatar-placeholder">
            <van-icon
              name="user-o"
              size="32"
              color="#fff"
            />
          </div>
        </template>
      </van-image>
      <div class="user-detail">
        <h3 class="user-name">
          {{ userInfo.teamName || userInfo.nickname }}
        </h3>
        <p class="user-id">
          ID: {{ userInfo.id }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  userInfo: {
    id: string
    nickname: string
    avatar: string
    phone: string
    teamName: string
  }
}>()
</script>

<style scoped lang="scss">
// 用户信息头部
.user-header {
  background: linear-gradient(135deg, #1989fa 0%, #4fc3f7 100%);
  padding: 40px 20px 30px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
}

.user-detail {
  .user-name {
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 4px;
  }

  .user-id {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.8);
  }
}
</style>
