<template>
  <div class="category-scroll">
    <div class="category-list">
      <div
        v-for="category in categories"
        :key="category.id"
        class="category-item"
        :class="{ active: activeCategory === category.id }"
        @click="selectCategory(category.id)"
      >
        <span class="category-name">{{ category.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 分类项接口
 */
interface Category {
  id: string
  name: string
  value: string
}

/**
 * 分类列表组件属性
 */
interface CategoryListProps {
  categories: Category[]
  activeCategory: string
}

/**
 * 分类列表组件事件
 */
interface Emits {
  (e: 'update:activeCategory', id: string): void
  (e: 'select', id: string): void
}

const { categories, activeCategory } = defineProps<CategoryListProps>()
const emit = defineEmits<Emits>()

/**
 * 选择分类
 */
const selectCategory = (categoryId: string) => {
  emit('update:activeCategory', categoryId)
  emit('select', categoryId)
}
</script>

<style scoped lang="scss">
.category-scroll {
  background-color: #ffffff;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.category-list {
  display: flex;
  overflow-x: auto;
  padding: 0 12px;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }
}

.category-item {
  flex-shrink: 0;
  padding: 8px 16px;
  margin-right: 8px;
  border-radius: 20px;
  font-size: 13px;
  color: #666;
  background-color: #f5f5f5;
  cursor: pointer;
  transition: all 0.3s;

  &.active {
    color: #ffffff;
    background-color: #1989fa;
  }
}
</style>
