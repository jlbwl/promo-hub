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
  position: relative;
  overflow: hidden;
  padding: 34px 18px 40px;
  background: var(--mast);
  color: var(--on-dark);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      96deg,
      rgba(255, 235, 205, 0.045) 0 1px,
      transparent 1px 7px
    );
  }
}

.user-info {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 14px;

  :deep(.van-image) {
    flex: none;
    border: 1px solid rgba(216, 176, 122, 0.3);
    box-shadow: 0 6px 18px -8px rgba(0, 0, 0, 0.5);
  }
}

.avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: rgba(216, 176, 122, 0.28);
  border-radius: 50%;
}

.user-detail {
  min-width: 0;

  .user-name {
    font-size: 18px;
    font-weight: 650;
    color: var(--on-dark);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .user-id {
    font-size: 10.5px;
    letter-spacing: 0.04em;
    color: var(--on-dark-muted);
  }
}
</style>
