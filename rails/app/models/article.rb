class Article < ApplicationRecord
  belongs_to :user
  enum :status, { unsaved: 10, draft: 20, published: 30 }
  scope :not_unsaved, -> { where.not(status: :unsaved) }
  validates :title, :content, presence: true, if: :published?
  validate :verify_only_one_unsaved_status_is_allowed

  private

    def verify_only_one_unsaved_status_is_allowed
      return unless unsaved?
      return unless user.articles.unsaved.where.not(id: id).exists?

      raise StandardError, "未保存の記事は複数保有できません"
    end
end
